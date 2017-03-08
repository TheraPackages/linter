'use babel'

const Interact = require('interact.js')
import {CompositeDisposable} from 'atom'
import {Message} from './message-element'
import HintTips from './hint-tips'
import HintTipsValid from './hint-tips-valid'
const ERROR   = 1
const WARNING = 2
const INFO    = 3
const VERBOSE  = 4

export default class BottomPanel {
  constructor(scope) {
    this.subscriptions = new CompositeDisposable

    // this.visibility = false
    this.expanded = false;
    this.visibleMessages = 0
    this.alwaysTakeMinimumSpace = atom.config.get('linter.alwaysTakeMinimumSpace')
    this.errorPanelHeight = atom.config.get('linter.errorPanelHeight')
    this.configVisibility = atom.config.get('linter.showErrorPanel')
    this.scope = scope
    this.editorMessages = new Map()
    this.messages = new Map()
    this.onNextError = null;

    //
    // Header start
    //

    this.hintLevel = atom.config.get('linter.hintLevel')

    if (!this.hintLevel) {
      this.hintLevel = VERBOSE
    }

    const elementHeader = document.createElement('linter-panel-header')
    this.header = document.createElement('div')
    var select = document.createElement('select')
    var arr = [
      { name: "Error", value: ERROR },
      { name: "Warning", value: WARNING },
      { name: "Note", value: INFO },
      { name: "Verbose", value: VERBOSE }
    ]

    for (var i = 0; i < arr.length; i++) {
      var objOption = new Option(arr[i].name, arr[i].value)
      select.add(objOption)
    }
    select.className = "linter-header-items-select"
    var label = document.createElement("span")
    label.innerHTML = "Hint Filter"
    label.className = "linter-header-items"
    this.header.appendChild(label)
    var _self = this;
    select.onchange = function (e) {
      var s = e.target
      // Resove the new selected index
      _self.hintLevel = s.options[s.options.selectedIndex].value
      atom.config.set('linter.hintLevel', _self.hintLevel)
      // filter message
      _self.resoveMessages()
    }

    select.options.selectedIndex = this.hintLevel - 1
    this.header.appendChild(select)

    var button = document.createElement("span");
    this.btnSwitch = button;
    button.className = "linter-header-items-ls fa fa-list";

    var _self = this;
    button.addEventListener('click', function () {
        if (_self.expanded) {
            _self.panel.hide();
            _self.expanded = false;
        } else {
            _self.panel.show();
            _self.expanded = true;
        }
        _self.refresh(null);
    });

    button.addEventListener('mouseover', function () {
        button.style.color = '#ffffff';
    })

    button.addEventListener('mouseout', function () {
        button.style.color = null;
    })

    this.header.appendChild(button);

    this.hintTips = HintTips.create();
    this.header.appendChild(this.hintTips);
    this.hintTips.display(false);
    this.hintTips.setOnNextError(() => {
        if (this.onNextError) {
            this.onNextError();
        }
    });

    this.hintTipsValid = HintTipsValid.create();
    this.header.appendChild(this.hintTipsValid);
    this.hintTipsValid.display(false);

    elementHeader.appendChild(this.header);
    this.panelHeader = atom.workspace.addBottomPanel({item: elementHeader, visible: true, priority: 501})

    //
    // Header end
    //

    const element = document.createElement('linter-panel') // TODO(steelbrain): Make this a `div`
    element.tabIndex = '-1'
    this.messagesElement = document.createElement('div')
    element.appendChild(this.messagesElement)
    this.panel = atom.workspace.addBottomPanel({item: element, visible: true, priority: 500})

    // Interact(elementHeader).resizable({edges: {top: true}})
    //   .on('resizemove', event => {
    //     element.style.height = `${event.rect.height}px`
    //     // event.target.style.height = `${event.rect.height}px`
    //   })
    //   .on('resizeend', event => {
    //     atom.config.set('linter.errorPanelHeight', event.target.clientHeight)
    //   })
    //
    // Interact(element).resizable({edges: {top: true}})
    //   .on('resizemove', event => {
    //     event.target.style.height = `${event.rect.height}px`
    //   })
    //   .on('resizeend', event => {
    //     atom.config.set('linter.errorPanelHeight', event.target.clientHeight)
    //   })
    // element.addEventListener('keydown', function(e) {
    //   if (e.which === 67 && e.ctrlKey) {
    //     atom.clipboard.write(getSelection().toString())
    //   }
    // })

    this.subscriptions.add(atom.config.onDidChange('linter.alwaysTakeMinimumSpace', ({newValue}) => {
      this.alwaysTakeMinimumSpace = newValue
      this.updateHeight()
    }))

    this.subscriptions.add(atom.config.onDidChange('linter.errorPanelHeight', ({newValue}) => {
      this.errorPanelHeight = newValue
      this.updateHeight()
    }))

    this.subscriptions.add(atom.config.onDidChange('linter.showErrorPanel', ({newValue}) => {
      this.configVisibility = newValue
      this.updateVisibility()
    }))

    this.subscriptions.add(atom.workspace.observeActivePaneItem(paneItem => {
      this.paneVisibility = paneItem === atom.workspace.getActiveTextEditor()
      this.updateVisibility()
    }))

    // Container for messages with no filePath
    const defaultContainer = document.createElement('div')
    this.editorMessages.set(null, defaultContainer)
    this.messagesElement.appendChild(defaultContainer)
    if (scope !== 'Project') {
      defaultContainer.setAttribute('hidden', true)
    }
  }

  isError(str) {
    return 'Error'.toUpperCase() == str.toUpperCase();
  }

  isWarning(str) {
    return 'Warning'.toUpperCase() == str.toUpperCase();
  }

  isNote(str) {
    const NAMES = ['Info', 'Note'];
    for (var name in NAMES)
      if (name.toUpperCase() == str.toUpperCase())
        return true;
    return false;
  }

  isVerbose(str) {
    return 'Verbose'.toUpperCase() == str.toUpperCase();
  }

  resoveMessages() {
    if (this.messages) {
      this.messages.forEach((item, key, map) => {

        var hintLevel = (errString) => {
          if (this.isError(errString)) {
            return ERROR;
          } else if (this.isWarning(errString)) {
            return WARNING;
          } else if (this.isNote(errString)) {
            return INFO;
          }
          return VERBOSE;
        }

        var level = hintLevel(key.class);
        if (level > this.hintLevel) {
          item.setAttribute("hidden", true);
        } else {
          item.removeAttribute("hidden");
        }
      })

      this.refresh(null)
    }
  }

  setMessages({added, removed}) {

    if (removed.length) {
      this.removeMessages(removed)
    }
    if (added.length) {
      let activeFile = atom.workspace.getActiveTextEditor()
      activeFile = activeFile ? activeFile.getPath() : undefined
      added.forEach(message => {
        if (!this.editorMessages.has(message.filePath)) {
          const container = document.createElement('div')
          this.editorMessages.set(message.filePath, container)
          this.messagesElement.appendChild(container)
          if (!(this.scope === 'Project' || activeFile === message.filePath)) {
            container.setAttribute('hidden', true)
          }
        }
        const messageElement = Message.fromMessage(message)
        this.messages.set(message, messageElement)
        this.editorMessages.get(message.filePath).appendChild(messageElement)
        if (messageElement.updateVisibility(this.scope).visibility) {
          this.visibleMessages++
        }
      })
    }

    this.editorMessages.forEach((child, key) => {
      // Never delete the default container
      if (key !== null && !child.childNodes.length) {
        child.remove()
        this.editorMessages.delete(key)
      }
    })

    // Due to the hint level.
    this.resoveMessages();
    this.updateVisibility()
  }
  removeMessages(messages) {
    messages.forEach(message => {
      const messageElement = this.messages.get(message)
      this.messages.delete(message)
      messageElement.remove()
      if (messageElement.visibility) {
        this.visibleMessages--
      }
    })
  }
  refresh(scope) {

    if (this.expanded) {
        this.btnSwitch.className = "linter-header-items-ls fa fa-chevron-down";
    } else {
        this.btnSwitch.className = "linter-header-items-ls fa fa-list";
    }

    if (scope) {
      this.scope = scope
    } else scope = this.scope
    this.visibleMessages = 0

    this.messages.forEach(messageElement => {
      if (messageElement.updateVisibility(scope).visibility && scope === 'Line') {
        this.visibleMessages++
      }
    })

    var err = 0;
    var warn = 0;
    var note = 0;

    if (scope === 'File') {
      let activeFile = atom.workspace.getActiveTextEditor()
      activeFile = activeFile ? activeFile.getPath() : undefined
      this.editorMessages.forEach((messagesElement, filePath) => {
        if (filePath === activeFile) {
          messagesElement.removeAttribute('hidden')
          this.visibleMessages = messagesElement.childNodes.length
          if (this.visibleMessages > 0) {
            messagesElement.childNodes.forEach((elem) => {
              if (this.isError(elem.message.class)) {
                err++;
              } else if (this.isWarning(elem.message.class)) {
                warn++;
              } else if (this.isNote(elem.message.class)) {
                note++;
              }
            });
          }

        } else {
          messagesElement.setAttribute('hidden', true);
        }
      })
    } else if (scope === 'Project') {
      this.visibleMessages = this.messages.size
      this.editorMessages.forEach(messageElement => {
        messageElement.removeAttribute('hidden');

        if (messageElement.childNodes.length > 0) {
          messageElement.childNodes.forEach((elem) => {
            if (this.isError(elem.message.class)) {
              err++;
            } else if (this.isWarning(elem.message.class)) {
              warn++;
            } else if (this.isNote(elem.message.class)) {
              note++;
            }
          });
        }

      })
    }

    if (this.hintTips) {
      this.hintTips.setErrorsCount(err);
      this.hintTips.setWarningsCount(warn);
      this.hintTips.setNotesCount(note);
      this.hintTips.updateHintInfo();

      if (err == 0 && warn == 0 && note == 0) {
          this.hintTips.display(false);
          this.hintTipsValid.display(true);
      } else {
          this.hintTips.display(true);
          this.hintTipsValid.display(false);
      }
    }

    this.updateVisibility()
  }
  updateHeight() {
    let height = this.errorPanelHeight

    if (this.alwaysTakeMinimumSpace) {
      // Add `1px` for the top border.
      height = Math.min(this.messagesElement.clientHeight + 1, height)
    }

    this.messagesElement.parentNode.style.height = `${height}px`
  }
  getVisibility() {
    return this.visibility
  }
  showMessageCount() {
    var visibleCounts = 0
    if (this.messages) {
      this.messages.forEach((item) => {
        if (!item.hasAttribute('hidden')) {
          visibleCounts++
        }
      })
    }
    return visibleCounts
  }
  updateVisibility() {

      if (this.expanded) {
          this.panel.show()
      } else {
          this.panel.hide()
      }

    // this.visibility = this.configVisibility && this.paneVisibility && this.visibleMessages > 0
    //
    // if (this.visibility) {
    //   if (0 == this.showMessageCount()) {
    //     this.panel.hide()
    //   } else {
    //     if (this.expanded) {
    //         this.panel.show()
    //     } else {
    //         this.panel.hide()
    //     }
    //   }
    //   this.panelHeader.show()
    //   this.updateHeight()
    // } else {
    //   this.panel.hide()
    // //   this.panelHeader.hide()
    // }
    return this;
  }

  setOnNextError(callback) {
      this.onNextError = callback;
  }

  dispose() {
    this.subscriptions.dispose()
    this.messages.clear()
    try {
      this.panel.destroy()
      this.panelHeader.destroy()
    } catch (err) {
      // Atom fails weirdly sometimes when doing this
    }
  }

}
