import {
  Rect,
  ZRenderType,
  dispose,
  init,
  BezierCurve,
  Group,
  BezierCurveShape,
  registerPainter,
} from 'zrender';
import CanvasPainter from 'zrender/lib/canvas/Painter';
import { Disposable } from './dispose';
import { InnerNode } from './tidy';
import { visit } from './utils';

registerPainter('canvas', CanvasPainter);
export interface ThemeProps {
  dark?: boolean;
  lineColor?: string;
  blockColor?: string;
  borderColor?: string;
}

export class Renderer extends Disposable {
  private render: ZRenderType;
  private root: InnerNode | undefined;
  private group: Group | undefined;
  private nodeMap: Map<number, InnerNode> = new Map();
  private rectMap: Map<number, Rect> = new Map();
  private lineSourceMap: Map<number, { line: BezierCurve; id: number }[]> =
    new Map();
  private lineTargetMap: Map<number, { line: BezierCurve; id: number }[]> =
    new Map();
  constructor(container: HTMLElement, private theme: ThemeProps = {}) {
    super();
    this.render = init(container);
    this._register({
      dispose: () => {
        dispose(this.render);
      },
    });

    if (theme.dark) {
      theme.blockColor = theme.blockColor ?? '#4a4bd2';
      theme.lineColor = theme.lineColor ?? '#eee';
      theme.borderColor = theme.borderColor ?? '#eee';
    } else {
      theme.blockColor = theme.blockColor ?? '#5d72b1';
      theme.lineColor = theme.lineColor ?? '#a8bbf0';
      theme.borderColor = theme.borderColor ?? '#5d72b1';
    }
  }

  init(root: InnerNode) {
    this.root = root;
    const g = new Group();
    this.group = g;
    this.render.add(g);
    g.setPosition([12,this.render.getHeight() / 2]);
    visit(root, (node) => {
      this.addNode(node, g);
    });
    this.rescale();
  }

  clear() {
    this.render.clear();
    if (this.group) {
      this.group.removeAll();
      this.render.remove(this.group);
    }
    this.nodeMap.clear();
    this.rectMap.clear();
  }

  private rescale() {
    if (!this.root || !this.group) {
      return;
    }
    const g = this.group;
    const gBox = g.getBoundingRect();
    const w = this.render.getWidth();
    const h = this.render.getHeight();
    const scale = Math.min(
      Math.abs(w / -gBox.x / 2),
      Math.abs(w / (gBox.width + gBox.x) / 2),
      w / (gBox.width + 20),
      h / (gBox.height + 50),
      5,
    );
    g.animateTo({ scaleX: scale, scaleY: scale });
  }

  private addNode(node: InnerNode, g: Group, createToParentLine = false) {
    //可自行实现dom
    const rect = new Rect({
      shape: {
        y: node.x - node.width / 2,
        x: node.y,
        height: node.width,
        width: node.height,
        r: 4,
      },
      style: {
        stroke: this.theme.borderColor,
        fill: this.theme.blockColor,
      },
    });
    this.rectMap.set(node.id, rect);
    this.nodeMap.set(node.id, node);
    g.add(rect);

    for (const child of node.children) {
      this.addLine(node, child, g);
    }

    if (createToParentLine && node.parentId) {
      this.addLine(this.nodeMap.get(node.parentId)!, node, g);
    }
  }

  private addLine(node: InnerNode, child: InnerNode, g: Group) {
    const line = new BezierCurve({
      shape: getBezierCurveShape(node, child),
      style: {
        stroke: this.theme.lineColor,
      },
    });

    g.add(line);
    get(this.lineSourceMap, node.id, [])!.push({ line, id: child.id });
    get(this.lineTargetMap, child.id, []).push({ line, id: node.id });
  }

  update() {
    if (!this.root || !this.group) {
      return;
    }
    const g = this.group;
    const removedNodeIds = new Set<number>(this.rectMap.keys());
    visit(this.root, (node) => {
      removedNodeIds.delete(node.id);
      if (!this.rectMap.has(node.id)) {
        this.addNode(node, g, true);
        return;
      }

      const rect = this.rectMap.get(node.id)!;
      if (eq(rect.x, node.x - node.width / 2) && eq(rect.y, node.y)) {
        return;
      }

      rect.animateTo({ shape: { x: node.x - node.width / 2, y: node.y } });
      const outLines = get(this.lineSourceMap, node.id, []);
      for (const { id, line } of outLines) {
        const child = this.nodeMap.get(id)!;
        line.animateTo({
          shape: getBezierCurveShape(node, child),
        });
      }
      const inLines = get(this.lineTargetMap, node.id, []);
      for (const { id, line } of inLines) {
        const child = node;
        const parent = this.nodeMap.get(id)!;
        line.animateTo({
          shape: getBezierCurveShape(parent, child),
        });
      }
    });

    for (const id of removedNodeIds) {
      const rect = this.rectMap.get(id)!;
      this.group.remove(rect);
      this.rectMap.delete(id);
      const lines = (this.lineSourceMap.get(id) ?? []).concat(
        this.lineTargetMap.get(id) ?? [],
      );
      for (const line of lines) {
        this.group.remove(line.line);
      }
      this.lineSourceMap.delete(id);
      this.lineTargetMap.delete(id);
    }
    for (let i = 0; i <= 1000; i += 500) {
      setTimeout(() => {
        this.rescale();
      }, i);
    }
  }
}

function getBezierCurveShape(
  parent: InnerNode,
  child: InnerNode,
): Partial<BezierCurveShape> {
  return {
    y1: parent.x,
    x1: parent.y + parent.height,
    y2: child.x,
    x2: child.y,
    cpy1: parent.x,
    cpx1: (child.y + parent.y + parent.height) / 2,
    cpy2: child.x,
    cpx2: (child.y + parent.y + parent.height) / 2,
  };
}

function eq(a: number, b: number) {
  return Math.abs(a - b) < 1e-6;
}

function get<K, V>(map: Map<K, V>, key: K, defaultValue: V) {
  if (map.has(key)) {
    return map.get(key)!;
  }
  map.set(key, defaultValue);
  return defaultValue;
}
