import { extname } from 'path';
import Promise from 'bluebird';
import { readFile, readFileSync } from 'hexo-fs';
import type Hexo from './index';
import type { Renderer } from '../extend';
import type { StoreFunctionData } from '../extend/renderer';

const getExtname = (str: string) => {
  if (typeof str !== 'string') return '';

  const ext = extname(str);
  return ext.startsWith('.') ? ext.slice(1) : ext;
};

const toString = (result, options) => {
  if (!Object.prototype.hasOwnProperty.call(options, 'toString') || typeof result === 'string') return result;

  if (typeof options.toString === 'function') {
    return options.toString(result);
  } else if (typeof result === 'object') {
    return JSON.stringify(result);
  } else if (result.toString) {
    return result.toString();
  }

  return result;
};

class Render {
  public context: Hexo;
  public renderer: Renderer;

  constructor(ctx: Hexo) {
    this.context = ctx;
    this.renderer = ctx.extend.renderer;
  }

  isRenderable(path: string) {
    return this.renderer.isRenderable(path);
  }

  isRenderableSync(path: string) {
    return this.renderer.isRenderableSync(path);
  }

  getOutput(path: string) {
    return this.renderer.getOutput(path);
  }

  getRenderer(ext: string, sync?: boolean) {
    return this.renderer.get(ext, sync);
  }

  getRendererSync(ext: string) {
    return this.getRenderer(ext, true);
  }

  render(data: StoreFunctionData, options?: { highlight?: boolean; }, callback?: undefined) {
    if (!callback && typeof options === 'function') {
      callback = options;
      options = {};
    }

    const ctx = this.context;
    let ext = '';

    let promise;

    if (!data) return Promise.reject(new TypeError('No input file or string!'));

    if (data.text != null) {
      promise = Promise.resolve(data.text);
    } else if (!data.path) {
      return Promise.reject(new TypeError('No input file or string!'));
    } else {
      promise = readFile(data.path);
    }

    return promise.then(text => {
      data.text = text;
      ext = data.engine || getExtname(data.path);
      if (!ext || !this.isRenderable(ext)) return text;

      const renderer = this.getRenderer(ext);
      return Reflect.apply(renderer, ctx, [data, options]);
    }).then(result => {
      result = toString(result, data);
      if (data.onRenderEnd) {
        return data.onRenderEnd(result);
      }

      return result;
    }).then(result => {
      const output = this.getOutput(ext) || ext;
      return ctx.execFilter(`after_render:${output}`, result, {
        context: ctx,
        args: [data]
      });
    }).asCallback(callback);
  }

  renderSync(data: StoreFunctionData, options = {}) {
    if (!data) throw new TypeError('No input file or string!');

    const ctx = this.context;

    if (data.text == null) {
      if (!data.path) throw new TypeError('No input file or string!');
      data.text = readFileSync(data.path) as string;
    }

    if (data.text == null) throw new TypeError('No input file or string!');

    const ext = data.engine || getExtname(data.path);
    let result;

    if (ext && this.isRenderableSync(ext)) {
      const renderer = this.getRendererSync(ext);
      result = Reflect.apply(renderer, ctx, [data, options]);
    } else {
      result = data.text;
    }

    const output = this.getOutput(ext) || ext;
    result = toString(result, data);

    if (data.onRenderEnd) {
      result = data.onRenderEnd(result);
    }

    return ctx.execFilterSync(`after_render:${output}`, result, {
      context: ctx,
      args: [data]
    });
  }
}

export = Render;
