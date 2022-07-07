/*
 * Copyright (c) 2020 FinancialForce.com, inc. All rights reserved.
 */
import { LogLine, Method, Detail, RootNode, TimedNode } from "./parsers/TreeParser";
import formatDuration, { showTab } from "./Util";
import { hostService, OpenInfo } from "./services/VSCodeService";

let treeRoot: RootNode;
const divElem = document.createElement("div");
const spanElem = document.createElement("span");
const linkElem = document.createElement("a");

function onExpandCollapse(evt: Event) {
  const input = evt.target as HTMLElement;
  if (input.classList.contains("toggle")) {
    const pe = input.parentElement,
      toggle = pe?.querySelector(".toggle");
    let childContainer = pe?.querySelector<HTMLElement>(".childContainer");

    const timestamp = pe?.dataset.enterstamp;
    if (!childContainer && timestamp) {
      const node = findByTimeStamp(treeRoot, timestamp);
      const childLen = node?.children.length || 0;
      childContainer = node && childLen ? createChildNodes(node.children, [node.timestamp]) : null;
      if (childContainer) {
        pe.appendChild(childContainer);
      }

      showHideDetails();
    }

    if (toggle && childContainer) {
      switch (toggle.textContent) {
        case "+":
          // expand
          childContainer.classList.remove("hide");
          toggle.textContent = "-";
          break;
        case "-":
          // collapse
          childContainer.classList.add("hide");
          toggle.textContent = "+";
          break;
      }
    }
  }
}

export function showTreeNode(timestamp: number) {
  const methodElm = renderCallStack(timestamp);
  showHideDetails();
  if (methodElm) {
    const methodName = methodElm?.querySelector("span.name") || methodElm;
    showTab("treeTab");
    expandTreeNode(methodElm);
    methodElm.scrollIntoView(false);
    if (methodName) {
      document.getSelection()?.selectAllChildren(methodName);
    }
  }
}

function renderCallStack(timestamp: number) {
  let methodElm = document.querySelector(`div[data-enterstamp="${timestamp}"]`) as HTMLElement;

  if (!methodElm) {
    let nodeToAttachTo;
    let nodeToStartAt;

    const callstack = findCallstack(treeRoot, timestamp) || [];
    const len = callstack.length;
    for (let i = 0; i < len; i++) {
      const node = callstack[i];
      if (node) {
        const isRendered = document.querySelector(
          `div[data-enterstamp="${node.timestamp}"]`
        ) as HTMLElement;
        if (isRendered) {
          nodeToAttachTo = isRendered;
          nodeToStartAt = node;
          continue;
        }
        break;
      }
    }

    const timeStamps = callstack.map((node) => {
      if (node?.timestamp) {
        return node.timestamp;
      }
    }) as number[];

    if (nodeToStartAt?.children.length && nodeToAttachTo) {
      const childContainer = createChildNodes(nodeToStartAt.children, timeStamps);
      if (childContainer) {
        nodeToAttachTo.appendChild(childContainer);
      }

      methodElm = document.querySelector(`div[data-enterstamp="${timestamp}"]`) as HTMLElement;
    }
  }
  return methodElm;
}

function findCallstack(node: LogLine, timeStamp: number): LogLine[] | null {
  if (node.timestamp === timeStamp) {
    return [node];
  }

  const len = node.children.length;
  for (let i = 0; i < len; i++) {
    const child = node.children[i];
    const timeStamps = findCallstack(child, timeStamp);
    if (timeStamps) {
      timeStamps.unshift(child);
      return timeStamps;
    }
  }
  return null;
}

function expandTreeNode(elm: HTMLElement) {
  const elements = [];
  let element: HTMLElement | null = elm.parentElement;
  while (element && element.id !== "tree") {
    if (element.id) {
      elements.push(element);
    }
    element = element.parentElement;
  }

  const elemsToShow: HTMLElement[] = [elm];
  const len = elements.length;
  for (let i = 0; i < len; i++) {
    const elem = elements[i];
    elemsToShow.push(elem);

    const toggle = elem.querySelector(`:scope > .toggle`),
      childContainer = elem.querySelector(`:scope > .childContainer`) as HTMLElement;

    if (toggle) {
      elemsToShow.push(childContainer);
      toggle.textContent = "-";
    }
  }

  elemsToShow.forEach((e) => e.classList.remove("hide"));
}

function describeMethod(node: Method) {
	const methodPrefix = node.prefix || '',
		methodSuffix = node.suffix || '';

	let desc = methodPrefix;
	if (node.summaryCount) {
		desc += (node.group || node.text);
	} else {
		desc += node.text;
	}
	if (node instanceof Method && node.duration && node.selfTime) {
		if (node.value) {
			desc += (' = ' + node.value);
		}
		if (node.rowCount !== null) {
			desc += ' Rows:' + node.rowCount;
		}
		desc += methodSuffix + ' - ';
		desc += node.isTruncated ? 'TRUNCATED' : formatDuration(node.duration) + ' (' + formatDuration(node.selfTime) + ')';
		if (node.lineNumber) {
			desc += ', line: ' + node.lineNumber;
		}
	}
	if (node.containsDml || node.containsSoql || node.containsThrown) {
		let prefix = [];
		if (node.containsDml) {
			prefix.push('D' + node.containsDml);
		}
		if (node.containsSoql) {
			prefix.push('S' + node.containsSoql);
		}
		if (node.containsThrown) {
			prefix.push('T' + node.containsThrown);
		}
		desc = '(' + prefix.join(',') + ') ' + desc;
	}

	return desc;
}

function renderBlock(line: LogLine) {
  const lineNode = divElem.cloneNode() as HTMLDivElement;
    lineNode.className = line instanceof Detail && line.hideable ? 'block name detail' : 'block name';

  const value = line.text || "";
  let text = line.type + (value && value !== line.type ? " - " + value : "");
  text = text.replace(/ \| /g, "\n");
  if (text.endsWith("\\")) {
    text = text.slice(0, -1);
  }

  lineNode.textContent = text;
  return lineNode;
}

function hasCodeText(node: LogLine): boolean {
  return node.hasValidSymbols;
}

function deriveOpenInfo(node: LogLine): OpenInfo | null {
  if (!hasCodeText(node)) {
    return null;
  }

  const text = node.text;
  const lineNumber = node.lineNumber ? "-" + node.lineNumber : "";
  const bracketIndex = text.indexOf("(");
  const qname = bracketIndex > -1 ? text.substring(0, bracketIndex) : text;

  let typeName;
  if (node.type === "METHOD_ENTRY") {
    const lastDot = qname.lastIndexOf(".");
    typeName = text.substring(0, lastDot) + lineNumber;
  } else {
    typeName = qname + lineNumber;
  }

  return {
    typeName: typeName,
    text: text,
  };
}

function renderMethod(node: Method, timeStamps: number[]) {
  const children = node.children;
  const mainNode = divElem.cloneNode() as HTMLDivElement;
  if (node.timestamp >= 0) {
    mainNode.dataset.enterstamp = "" + node.timestamp;
    mainNode.id = `calltree-${node.timestamp}`;
  }
  if (node.duration) {
    mainNode.dataset.totaltime = "" + node.duration;
  }
  mainNode.className = node.classes || "";

  const len = children.length;
  if (len) {
    const toggle = spanElem.cloneNode() as HTMLSpanElement;
    toggle.textContent = "+";
    toggle.className = "toggle";
    mainNode.appendChild(toggle);
  } else {
    mainNode.classList.add("indent");
  }

  const titleSpan = spanElem.cloneNode() as HTMLSpanElement;
  titleSpan.className = "name";
  const titleText = describeMethod(node);
  titleSpan.appendChild(document.createTextNode(titleText));
  mainNode.appendChild(titleSpan);

  if (len && (timeStamps.includes(node.timestamp) || timeStamps.includes(-1))) {
    const childContainer = createChildNodes(children, timeStamps);
    if (childContainer) {
      mainNode.appendChild(childContainer);
    }
  }

  return mainNode;
}

function createChildNodes(children: LogLine[], timeStamps: number[]) {
  const childContainer = divElem.cloneNode() as HTMLDivElement;
  childContainer.className = "childContainer hide";
  children.forEach(child => {
		if (child instanceof Method) {
      childContainer.appendChild(renderMethod(child, timeStamps));
    } else {
      childContainer.appendChild(renderBlock(child));
    }
  });
  return childContainer;
}

function renderTree() {
  const treeContainer = document.getElementById("tree") as HTMLElement;
  if (treeContainer) {
    treeContainer.addEventListener("click", onExpandCollapse);
    treeContainer.addEventListener("click", goToFile);

    const callTreeNode = renderMethod(treeRoot, [0]);
    treeContainer.innerHTML = "";
    if (callTreeNode) {
      treeContainer.appendChild(callTreeNode);
      const spacer = divElem.cloneNode() as HTMLDivElement;
      spacer.style.height = `78vh`;
      treeContainer.appendChild(spacer);
      showHideDetails();
    }
  }
}

function goToFile(evt: Event) {
  const elem = evt.target as HTMLElement;
  const target = elem.matches("a") ? elem.parentElement?.parentElement : null;
  const timeStamp = target?.dataset.enterstamp;
  if (timeStamp) {
    const node = findByTimeStamp(treeRoot, timeStamp);
    if (node) {
      const fileOpenInfo = deriveOpenInfo(node);
      if (fileOpenInfo) {
        hostService().openType(fileOpenInfo);
      }
    }
  }
}

function findByTimeStamp(node: TimedNode, timeStamp: string): LogLine | null {
  return findByTime(node, parseInt(timeStamp));
}

function findByTime(node: TimedNode, timeStamp: number): LogLine | null {
  if (node) {
    if (node.timestamp === timeStamp) {
      return node;
    }

    // do not search children is the timestamp is outside of the parents timeframe
    if (node.exitStamp && !(timeStamp >= node.timestamp && timeStamp <= node.exitStamp)) {
      return null;
    }

    const len = node.children.length;
    for (let i = 0; i < len; ++i) {
      const child = node.children[i];
      if (child instanceof TimedNode) {
        const target = findByTime(child, timeStamp);
        if (target) {
          return target;
        }
      }
    }
  }
  return null;
}

export default async function renderTreeView(rootMethod: RootNode) {
  treeRoot = rootMethod;
  renderTree();
}

function expand(elm: HTMLElement) {
  const toggles = elm.querySelectorAll(".toggle");
  toggles.forEach((toggle) => {
    toggle.textContent = "-";
  });

  const childContainers = document.querySelectorAll<HTMLElement>(".childContainer");
  childContainers.forEach((childContainer) => {
    if (!childContainer.classList.contains("block")) {
      childContainer.classList.remove("hide");
    }
  });
}

function renderLowest(elm: HTMLElement) {
  const toggle = elm.querySelector(`:scope > .toggle`),
    childContainer = elm.querySelector(`:scope > .childContainer`) as HTMLElement;

  if (toggle && !childContainer && elm.dataset.enterstamp) {
    const node = findByTimeStamp(treeRoot, elm.dataset.enterstamp || "");

    if (node?.children.length) {
      const childContainer = createChildNodes(node.children, [-1]);
      elm.appendChild(childContainer);
    }
  } else if (elm.children) {
    const len = elm.children.length;
    for (let i = 0; i < len; ++i) {
      renderLowest(elm.children[i] as HTMLElement);
    }
  }
}

function collapse(elm: HTMLElement) {
  const toggles = document.querySelectorAll(".toggle");
  toggles.forEach((toggle) => {
    toggle.textContent = "+";
  });

  const childContainers = elm.querySelectorAll<HTMLElement>(".childContainer");
  childContainers.forEach((childContainer) => {
    if (!childContainer.classList.contains("block")) {
      childContainer.classList.add("hide");
    }
  });
}

let previouslyExpanded = false;
function onExpandAll(evt: Event) {
  const treeContainer = document.getElementById("tree");
  if (!previouslyExpanded) {
    renderLowest(treeContainer as HTMLElement);
    previouslyExpanded = true;
  }
  if (treeContainer) {
    showHideDetails();
    expand(treeContainer);
  }
}

function onCollapseAll(evt: Event) {
  const treeContainer = document.getElementById("tree");
  if (treeContainer) {
    collapse(treeContainer);
  }
}

function hideBySelector(selector: string) {
  document.querySelectorAll<HTMLElement>(selector).forEach(hideElm);
}

function hideElm(elem: HTMLElement) {
  elem.classList.add("hide");
}

function showElm(elem: HTMLElement) {
  elem.classList.remove("hide");
}

function showHideDetails() {
  //  TODO: move to be update via an event instead of requerying.
  const hideDetails = document.getElementById("hideDetails") as HTMLInputElement,
    hideSystem = document.getElementById("hideSystem") as HTMLInputElement,
    hideFormula = document.getElementById("hideFormula") as HTMLInputElement;

  const elements = Array.from(
    document.querySelectorAll<HTMLElement>("#tree .node[data-totaltime]")
  );
  elements.forEach(showElm);

  hideByDuration(elements);
  if (hideDetails?.checked) {
    hideBySelector("#tree .detail");
  }
  if (hideSystem?.checked) {
    hideBySelector("#tree .node.system");
  }
  if (hideFormula?.checked) {
    hideBySelector("#tree .node.formula");
  }
}

function hideByDuration(elements: Array<HTMLElement>) {
  const hideUnder = document.getElementById("hideUnder") as HTMLInputElement;
  const shouldHide = hideUnder?.checked;

  if (shouldHide) {
    const timeInMS = document.getElementById("hideUnderTime") as HTMLInputElement;
    const timeFilter = +timeInMS.value * 1000000; // convert to nanoseconds
    if (timeFilter) {
      const elementsToHide = elements.filter((el) => {
        return Number(el.dataset.totaltime) < timeFilter;
      });
      elementsToHide.forEach(hideElm);
    }
  }
}

function onInitTree(evt: Event) {
  const expandAll = document.getElementById("expandAll"),
    collapseAll = document.getElementById("collapseAll"),
    hideDetails = document.getElementById("hideDetails"),
    hideSystem = document.getElementById("hideSystem"),
    hideFormula = document.getElementById("hideFormula"),
    hideDuration = document.getElementById("hideUnder"),
    timeInMS = document.getElementById("hideUnderTime");

  expandAll?.addEventListener("click", onExpandAll);
  collapseAll?.addEventListener("click", onCollapseAll);
  hideDetails?.addEventListener("change", showHideDetails);
  hideSystem?.addEventListener("change", showHideDetails);
  hideFormula?.addEventListener("change", showHideDetails);
  hideDuration?.addEventListener("change", showHideDetails);
  timeInMS?.addEventListener("input", showHideDetails);
}

window.addEventListener("DOMContentLoaded", onInitTree);
