'use babel'

import {CompositeDisposable, Emitter} from 'atom'

const TAGNAME = 'hint-tips-valid';
export default class HintTipsValid extends HTMLElement {

    initialize() {
    }

    createdCallback() {
        this.initialize();

        const ICON_SCALE = "scale(0.7)";

        var labelForInfo = document.createElement("span");
        labelForInfo.className = "fa-stack fa-lg";
        labelForInfo.style['width'] = "1em";
        labelForInfo.style['marginLeft'] = ".3em";
        var info = document.createElement("i");
        info.className = "fa fa-check fa-stack-1x";
        info.style.color = "#22dd99";
        info.style['transform'] = ICON_SCALE;
        labelForInfo.appendChild(info);
        this.appendChild(labelForInfo);

        this.updateHintInfo();
    }

    display(isShow) {
      if (isShow) {
        this.style['display'] = 'inline';
      } else {
        this.style['display'] = 'none';
      }
    }

    updateHintInfo() {
    }

    static create(activeTab) {
      return document.createElement(TAGNAME);
    }
}

document.registerElement(TAGNAME, {prototype: HintTipsValid.prototype})
