'use babel'

export default class PriorStack {

  constructor() {
    this.stack = []
    this.callback = null
  }

  push(a) {
    this.stack.push(a)
    this.sort()
  }

  pop() {
    r = this.stack.pop()
    this.sort()
    return r
  }

  remove (a) {
    this.stack = this.stack.filter((elem) => {
      if (elem == a) {
        return false
      }
      return true
    })

    this.sort()
  }

  setPrior(callback) {
    this.callback = callback
  }

  getTop() {
    if (this.stack.length == 0) {
      return null
    }

    return this.stack[0];
  }

  sort() {
    if (this.callback && typeof this.callback == "function") {
      this.stack = this.stack.sort(this.priorCmp.bind(this))
    }
  }

  priorCmp(a, b) {
    return this.callback(a, b)
  }
}
