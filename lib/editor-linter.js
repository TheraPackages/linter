'use babel'

import {Emitter, CompositeDisposable} from 'atom'
import Helpers from './helpers'
import {create as createBubble} from './ui/message-bubble'
import PriorStack from './prior-stack.js'

export default class EditorLinter {

  constructor(editor) {
    if (typeof editor !== 'object' || typeof editor.markBufferRange !== 'function') {
      throw new Error('Given editor is not really an editor')
    }

    this.editor = editor
    this.emitter = new Emitter()
    this.messages = new Set()
    this.markers = new Map()
    this.subscriptions = new CompositeDisposable
    this.gutter = null
    this.countLineMessages = 0
    this.bubble = null;
    this.isShouldShowBubble = false;

    this.lineTailMarkers = {}
    this.gutterMarkers = {}

    /// <summary>
    ///   Add global event...
    /// <summary>
    this.subscriptions.add(this.editor.onDidChangeScrollTop(() => {
        this.removeBubble();
    }));
    this.subscriptions.add(this.editor.onDidChangeScrollLeft(() => {
        this.removeBubble();
    }));
    this.subscriptions.add(this.editor.onDidChangeModified(() => {
        this.removeBubble();
    }));
    this.subscriptions.add(this.editor.onDidChangeCursorPosition(() => {
      if (!this.isShouldShowBubble) {
        this.removeBubble();
      }
      this.isShouldShowBubble = false;
    }));

    this.subscriptions.add(atom.config.observe('linter.underlineIssues', underlineIssues =>
      this.underlineIssues = underlineIssues
    ))
    this.subscriptions.add(atom.config.observe('linter.showErrorInline', showBubble =>
      this.showBubble = showBubble
    ))
    this.subscriptions.add(this.editor.onDidDestroy(() =>
      this.dispose()
    ))
    this.subscriptions.add(this.editor.onDidSave(() =>
      this.emitter.emit('should-lint', false)
    ))
    this.subscriptions.add(this.editor.onDidChangeCursorPosition(({oldBufferPosition, newBufferPosition}) => {
      if (newBufferPosition.row !== oldBufferPosition.row) {
        this.calculateLineMessages(newBufferPosition.row)
      }
      this.emitter.emit('should-update-bubble')
    }))
    this.subscriptions.add(atom.config.observe('linter.gutterEnabled', gutterEnabled => {
      this.gutterEnabled = gutterEnabled
      this.handleGutter()
    }))
    // Using onDidChange instead of observe here 'cause the same function is invoked above
    this.subscriptions.add(atom.config.onDidChange('linter.gutterPosition', () =>
      this.handleGutter()
    ))
    this.subscriptions.add(this.onDidMessageAdd(message => {

      if (!this.underlineIssues && !this.gutterEnabled && !this.showBubble || !message.range) {
        return // No-Op
      }
      const marker = this.editor.getBuffer().markRange(message.range, {invalidate: 'inside'})

      message.tipClass = `linetail-tip-${message.class}`

      this.editor.lineTailIndicatorAdd(message)
      if (this.markers.has(message.key)) {
        return;
      }
      this.markers.set(message.key, marker)

      if (this.underlineIssues) {
        this.editor.decorateMarker(marker, {
          type: 'highlight',
          class: `linter-highlight ${message.class}`
        })
      }

      if (this.gutterEnabled) {

        let row = message.range.start.row

        if (!this.gutterMarkers[row]) {
          let stack = new PriorStack

          stack.setPrior((a, b) => {

            let a_num = a.range.start.column
            let b_num = b.range.start.column

            if (a.class == 'error')
               a_num = a_num + 100000
            else if (a.class == 'warning')
               a_num = a_num + 10000
            else if (a.class == 'info')
               a_num = a_num + 1000

            if (b.class == 'error')
               b_num = b_num + 100000
            else if (b.class == 'warning')
               b_num = b_num + 10000
            else if (b.class == 'info')
               b_num = b_num + 1000

            return a_num < b_num
          })

          let gutterMaker = this.editor.getBuffer().markRange(message.range, {
            invalidate: 'inside'
          })

          stack.push(message)

          this.gutterMarkers[row] = {
            g: gutterMaker,
            s: stack
          }

          let item = this.createGutterItemFromMessage(message)

          this.gutter.decorateMarker(gutterMaker, {
            class: 'linter-row',
            item
          })

        } else {
          let markerObject = this.gutterMarkers[row]
          let stack = markerObject.s
          let gutterMaker = markerObject.g

          let newgutterMaker = this.editor.getBuffer().markRange(message.range, {
            invalidate: 'inside'
          })

          markerObject.g = newgutterMaker

          stack.push(message)
          let topMessage = stack.getTop()

          gutterMaker.destroy()
          gutterMaker = newgutterMaker

          let item = this.createGutterItemFromMessage(topMessage)
          this.gutter.decorateMarker(gutterMaker, {
              class: 'linter-row',
              item
          })
        }

        let lineMarker = this.editor.markBufferRange(message.range, {
          invalidate: 'never'
        })

        this.lineTailMarkers[message.key] = lineMarker
        editor.decorateMarker(lineMarker, {
          type: 'line',
          class: `${message.class}-color`
        })
      }
    }))

    this.subscriptions.add(this.onDidMessageDelete(message => {
      if (this.markers.has(message.key)) {
        this.markers.get(message.key).destroy()
        this.markers.delete(message.key)

        this.editor.lineTailIndicatorDelete(message)
        let lineMarker = this.lineTailMarkers[message.key];
        if (lineMarker) {
          lineMarker.destroy()
          delete this.lineTailMarkers[message.key]

          let row = message.range.start.row
          let markerObject = this.gutterMarkers[row]
          let stack = markerObject.s
          let gutterMaker = markerObject.g
          stack.remove(message)
          gutterMaker.destroy();

          let topMessage = stack.getTop()
          if (topMessage) {
            let gutterMaker = this.editor.getBuffer().markRange(message.range, {
              invalidate: 'inside'
            })
            markerObject.g = gutterMaker
            let item = this.createGutterItemFromMessage(topMessage)
            this.gutter.decorateMarker(gutterMaker, {
                class: 'linter-row',
                item
            })
          }
        }
      }
    }))

    // TODO: Atom invokes onDid{Change, StopChanging} callbacks immediately. Workaround it
    atom.config.observe('linter.lintOnFlyInterval', (interval) => {
      if (this.changeSubscription) {
        this.changeSubscription.dispose()
      }
      this.changeSubscription = this.editor.onDidChange(Helpers.debounce(() => {
        this.emitter.emit('should-lint', true)
      }, interval))
    })

    this.active = true
  }

  createGutterItemFromMessage(message) {
    const item = document.createElement('span')
    item.className = 'linter-highlight fa fa-warning'
    if (message.class == "warning") {
      item.className = 'linter-highlight fa fa-warning'
      item.style['color'] = "#ffd70f";
    } else if (message.class == "error") {
      item.className = 'linter-highlight fa fa-times-circle'
      item.style['color'] = "#ff5555";
    } else if (message.class == "info") {
      item.className = 'linter-highlight fa fa-info-circle'
      item.style['color'] = "#0abaff";
    }
    return item
  }

  removeBubble() {
    if (this.bubble) {
      this.bubble.bubbleMarker.destroy();
      this.bubble = null;
    }
  }

  set active(value) {
    value = Boolean(value)
    if (value !== this._active) {
      this._active = value
      if (this.messages.size) {
        this.messages.forEach(message => message.currentFile = value)
      }
    }
  }
  get active() {
    return this._active
  }

  handleGutter() {
    if (this.gutter !== null) {
      this.removeGutter()
    }
    if (this.gutterEnabled) {
      this.addGutter()
    }
  }

  addGutter() {
    const position = atom.config.get('linter.gutterPosition')
    this.gutter = this.editor.addGutter({
      name: 'linter',
      priority: position === 'Left' ? -100 : 100
    })
  }

  removeGutter() {
    if (this.gutter !== null) {
      try {
        // Atom throws when we try to remove a gutter container from a closed text editor
        this.gutter.destroy()
      } catch (err) {}
      this.gutter = null
    }
  }

  findFirstMessageInRow(rowNum) {
    if (this.messages == null || this.messages.length <= 0) {
      return null;
    }
    let targetMessage = null;
    for (let msg of this.messages) {
      if (msg.range && msg.range.start && msg.range.start.row == rowNum) {
        if (targetMessage == null) {
          targetMessage = msg;
        } else {
          if (targetMessage.range.start.column > msg.range.start.column) {
            targetMessage = msg;
          }
        }
      }
    }
    return targetMessage;
  }

  getMessages() {
    return this.messages
  }

  addMessage(message) {
    if (!this.messages.has(message)) {
      if (this.active) {
        message.currentFile = true
      }
      this.messages.add(message)
      this.emitter.emit('did-message-add', message)
      this.emitter.emit('did-message-change', {message, type: 'add'})
    }
  }

  deleteMessage(message) {
    if (this.messages.has(message)) {
      this.messages.delete(message)
      this.emitter.emit('did-message-delete', message)
      this.emitter.emit('did-message-change', {message, type: 'delete'})
    }
  }

  calculateLineMessages(row) {
    if (atom.config.get('linter.showErrorTabLine')) {
      if (row === null) {
        row = this.editor.getCursorBufferPosition().row
      }
      this.countLineMessages = 0
      this.messages.forEach(message => {
        if (message.currentLine = message.range && message.range.intersectsRow(row)) {
          this.countLineMessages++
        }
      })
    } else {
      this.countLineMessages = 0
    }
    this.emitter.emit('did-calculate-line-messages', this.countLineMessages)
    return this.countLineMessages
  }

  lint(onChange = false) {
    this.emitter.emit('should-lint', onChange)
  }

  onDidMessageAdd(callback) {
    return this.emitter.on('did-message-add', callback)
  }

  onDidMessageDelete(callback) {
    return this.emitter.on('did-message-delete', callback)
  }

  onDidMessageChange(callback) {
    return this.emitter.on('did-message-change', callback)
  }

  onDidCalculateLineMessages(callback) {
    return this.emitter.on('did-calculate-line-messages', callback)
  }

  onShouldUpdateBubble(callback) {
    return this.emitter.on('should-update-bubble', callback)
  }

  onShouldLint(callback) {
    return this.emitter.on('should-lint', callback)
  }

  onDidDestroy(callback) {
    return this.emitter.on('did-destroy', callback)
  }

  dispose() {
    this.emitter.emit('did-destroy')
    if (this.markers.size) {
      this.markers.forEach(marker => marker.destroy())
      this.markers.clear()
    }
    this.removeGutter()
    this.subscriptions.dispose()
    if (this.changeSubscription) {
      this.changeSubscription.dispose()
    }
    this.emitter.dispose()
    this.messages.clear()
  }
}
