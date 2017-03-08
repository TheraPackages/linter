'use babel'

import {CompositeDisposable, Emitter} from 'atom'

const TAGNAME = 'hint-tips';
export default class HintTips extends HTMLElement {

    initialize() {
        this._errors = 0;
        this._warnings = 0;
        this._notes = 0;
        this.textViewErrors = null;
        this.textViewErrors = null;
        this.textViewWarnings = null;
        this.textViewNotes = null;
        this.onNextError = null;
    }

    createdCallback() {
        this.initialize();

        const ICON_SCALE = "scale(0.7)";
        /// <summary>
        ///   错误提示
        /// </summary>
        var labelForError = document.createElement("span");
        labelForError.className = "fa-stack fa-lg";
        labelForError.style['width'] = "1em";
        labelForError.style['marginLeft'] = ".3em";

        var error = document.createElement("i");
        error.className = "fa fa-times-circle fa-stack-1x";
        error.style.color = "#cc4444";
        error.style['transform'] = ICON_SCALE;

        labelForError.appendChild(error);
        this.appendChild(labelForError);

        var labelForErrorText = document.createElement("span");
        labelForErrorText.className = "linter-head-text";
        this.textViewErrors = labelForErrorText;
        this.appendChild(labelForErrorText);


        /// <summary>
        ///   警告提示
        /// </summary>
        var labelForWarning = document.createElement("span");
        labelForWarning.className = "fa-stack fa-lg";
        labelForWarning.style['width'] = "1em";

        var warning = document.createElement("i");
        warning.className = "fa fa-warning fa-stack-1x";
        warning.style.color = "#bbbb00";
        warning.style['transform'] = ICON_SCALE;
        warning.style['width'] = "1em";

        labelForWarning.appendChild(warning);
        this.appendChild(labelForWarning);

        var labelForWarningText = document.createElement("span");
        labelForWarningText.className = "linter-head-text";
        this.textViewWarnings = labelForWarningText;
        this.appendChild(labelForWarningText);


        /// <summary>
        ///   一般的信息提示
        /// </summary>
        var labelForInfo = document.createElement("span");
        labelForInfo.className = "fa-stack fa-lg";
        labelForInfo.style['width'] = "1em";

        var info = document.createElement("i");
        info.className = "fa fa-info-circle fa-stack-1x";
        info.style.color = "#22aacc";
        info.style['transform'] = ICON_SCALE;
        labelForInfo.appendChild(info);
        this.appendChild(labelForInfo);

        var labelForInfoText = document.createElement("span");
        labelForInfoText.className = "linter-head-text";
        this.textViewNotes = labelForInfoText;
        this.appendChild(labelForInfoText);


        /// <summary>
        ///   快速转到错误
        /// </summary>
        const NORMAL_COLOR = "#aaaaaa";
        const OVER_COLOR = "#ffffff";
        var tag = document.createElement("span");
        tag.className = "fa-stack fa-lg";
        // tag.style['width'] = "1em";
        var tagGraph = document.createElement("i");
        tagGraph.className = "fa fa-arrow-down fa-stack-1x";
        tagGraph.style.color = NORMAL_COLOR;
        tagGraph.style['transform'] = 'scale(0.8)';

        tagGraph.addEventListener('mouseover', function () {
            tagGraph.style.color = OVER_COLOR;
        })

        tagGraph.addEventListener('mouseout', function () {
            tagGraph.style.color = null;
        })

        tagGraph.addEventListener('mousedown', function () {
            tagGraph.style.color = NORMAL_COLOR;
        })

        tagGraph.addEventListener('mouseup', function () {
            tagGraph.style.color = null;
        })

        tag.title = '快速定位到错误位置^^\n快捷键:[command]+[.]';
        var handle = tag.addEventListener('click', () => {
            if (this.onNextError) {
                this.onNextError();
            }
        });

        tag.appendChild(tagGraph);
        this.appendChild(tag);

        /// <summary>
        ///   更新信息
        /// </summary>

        this.updateHintInfo();
    }

    setErrorsCount(count) {
        this._errors = count;
    }

    setWarningsCount(count) {
        this._warnings = count;
    }

    setNotesCount(count) {
        this._notes = count;
    }

    updateHintInfo() {
        [
            this.textViewErrors.innerHTML,
            this.textViewWarnings.innerHTML,
            this.textViewNotes.innerHTML
        ] = [
            this._errors,
            this._warnings,
            this._notes
        ];
    }

    display(isShow) {
      if (isShow) {
        this.style['display'] = 'inline';
      } else {
        this.style['display'] = 'none';
      }
    }

    static create(activeTab) {
      return document.createElement(TAGNAME);
    }

    setOnNextError(callback) {
        this.onNextError = callback;
    }
}

document.registerElement(TAGNAME, {prototype: HintTips.prototype})
