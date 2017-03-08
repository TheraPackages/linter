'use babel'
import {Emitter, CompositeDisposable} from 'atom'

const Validate = require('./validate')
const Helpers = require('./helpers')

class MessageRegistry {
  constructor() {
    this.hasChanged = false
    this.shouldRefresh = true
    this.publicMessages = []
    this.subscriptions = new CompositeDisposable()
    this.emitter = new Emitter()
    this.linterResponses = new Map()
    this.messages = new Map()
    this.weexRuntimeMessages = [];

    this.subscriptions.add(this.emitter)
    this.subscriptions.add(atom.config.observe('linter.ignoredMessageTypes', value => this.ignoredMessageTypes = (value || [])))

    const UpdateMessages = () => {
      if (this.shouldRefresh) {
        if (this.hasChanged) {
          this.hasChanged = false
          this.updatePublic()
        }
        Helpers.requestUpdateFrame(UpdateMessages)
      }
    }
    Helpers.requestUpdateFrame(UpdateMessages)
  }
  set({linter, messages, editorLinter}) {
    if (linter.deactivated) {
      return
    }
    try {
      messages = messages.concat(this.weexRuntimeMessages);
      Validate.messages(messages, linter)
    } catch (e) { return Helpers.error(e) }
    messages = messages.filter(i => this.ignoredMessageTypes.indexOf(i.type) === -1)
    if (linter.scope === 'file') {
      if (!editorLinter) {
        throw new Error('Given editor is not really an editor')
      }
      if (!editorLinter.editor.isAlive()) {
        return
      }
      if (!this.messages.has(editorLinter)) {
        this.messages.set(editorLinter, new Map())
      }
      this.messages.get(editorLinter).set(linter, messages)
    } else { // It's project
      this.linterResponses.set(linter, messages)
    }

    this.hasChanged = true
  }
  weexRuntimeMessagesCommonlize(msg, editorLinter) {
    let type = "error";
    let clazz = "error";
    if (msg) {
      if (msg.startsWith("NOTE:")) {
        type = "note";
        clazz = "info";
      } else if (msg.startsWith("WARNING:")) {
        type = "warning";
        clazz = "warning";
      }
    }
    let commonMessage = {
      class: clazz,
      filePath: editorLinter.editor.getPath(),
      html: null,
      text: msg,
      trace: null,
      type: type
    };
    return commonMessage;
  }
  setWeexRuntimeMessage(msg, editorLinter) {

    if (msg.detail) {
      let error = JSON.parse(msg.detail);
      if (error instanceof Array) {
        let errors = error;
        this.weexRuntimeMessages = [];
        for (let err of errors) {
            let commonMessage = this.weexRuntimeMessagesCommonlize(err['reason'], editorLinter);
            this.weexRuntimeMessages.push(commonMessage);
        }
      } else if (error instanceof Object) {
        if (error['description']) {
          let commonMessage = this.weexRuntimeMessagesCommonlize(error['description'], editorLinter);
          this.weexRuntimeMessages.push(commonMessage);
        }
      }
    } else {
      this.weexRuntimeMessages = [];
    }

  }
  updatePublic() {
    let latestMessages = []
    let publicMessages = []
    let added = []
    let removed = []
    let currentKeys
    let lastKeys

    this.linterResponses.forEach(messages => latestMessages = latestMessages.concat(messages))
    this.messages.forEach(bufferMessages =>
      bufferMessages.forEach(messages => latestMessages = latestMessages.concat(messages))
    )

    currentKeys = latestMessages.map(i => i.key)
    lastKeys = this.publicMessages.map(i => i.key)

    for (let i of latestMessages) {
      if (lastKeys.indexOf(i.key) === -1) {
        added.push(i)
        publicMessages.push(i)
      }
    }

    for (let i of this.publicMessages)
      if (currentKeys.indexOf(i.key) === -1) {
        removed.push(i)
      } else publicMessages.push(i)

    this.publicMessages = publicMessages
    this.emitter.emit('did-update-messages', {added, removed, messages: publicMessages})
  }
  onDidUpdateMessages(callback) {
    return this.emitter.on('did-update-messages', callback)
  }
  deleteMessages(linter) {
    if (linter.scope === 'file') {
      this.messages.forEach(r => r.delete(linter))
      this.hasChanged = true
    } else if(this.linterResponses.has(linter)) {
      this.linterResponses.delete(linter)
      this.hasChanged = true
    }
  }
  deleteEditorMessages(editorLinter) {
    if (this.messages.has(editorLinter)) {
      this.messages.delete(editorLinter)
      this.hasChanged = true
    }
  }
  dispose() {
    this.shouldRefresh = false
    this.subscriptions.dispose()
    this.linterResponses.clear()
    this.messages.clear()
  }
}

module.exports = MessageRegistry
