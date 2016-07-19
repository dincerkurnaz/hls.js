/*
 * Fragment Loader
*/

import Event from '../events';
import EventHandler from '../event-handler';
import {ErrorTypes, ErrorDetails} from '../errors';
import {logger} from '../utils/logger';

class FragmentLoader extends EventHandler {

  constructor(hls) {
    super(hls, Event.FRAG_LOADING);
    this.loaders = {};
  }

  destroy() {
    for (let loaderName in this.loaders) {
      let loader = this.loaders[loaderName];
      if (loader) {
        loader.destroy();
      }
    }
    this.loaders = {};
    EventHandler.prototype.destroy.call(this);
  }

  onFragLoading(data) {
    let frag = data.frag,
        type = frag.type,
        loader = this.loaders[type],
        config = this.hls.config;

    frag.loaded = 0;
    if (loader) {
      logger.warn(`abort previous fragment loader for type:${type}`);
      loader.abort();
    }
    loader  = this.loaders[type] = frag.loader = typeof(config.fLoader) !== 'undefined' ? new config.fLoader(config) : new config.loader(config);

    let loaderContext, loaderConfig, loaderCallbacks;
    loaderContext = { url : frag.url, frag : frag, responseType : 'arraybuffer'};
    let start = frag.byteRangeStartOffset, end = frag.byteRangeEndOffset;
    if (!isNaN(start) && !isNaN(end)) {
      loaderContext.headers = { 'Range' : ('bytes=' + start + '-' + (end-1)) };
    }
    loaderConfig = { timeout : config.fragLoadingTimeOut, maxRetry : 1 , retryDelay : 0};
    loaderCallbacks = { onSuccess : this.loadsuccess.bind(this), onError :this.loaderror.bind(this), onTimeout : this.loadtimeout.bind(this), onProgress: this.loadprogress.bind(this)};
    loader.load(loaderContext,loaderConfig,loaderCallbacks);
  }

  loadsuccess(response, stats, context) {
    let payload = response.data, frag = context.frag;
    stats.length = payload.byteLength;
    // detach fragment loader on load success
    frag.loader = undefined;
    this.loaders[frag.type] = undefined;
    this.hls.trigger(Event.FRAG_LOADED, {payload: payload, frag: frag, stats: stats});
  }

  loaderror(response, context) {
    let loader = context.loader;
    if (loader) {
      loader.abort();
    }
    this.loaders[context.type] = undefined;
    this.hls.trigger(Event.ERROR, {type: ErrorTypes.NETWORK_ERROR, details: ErrorDetails.FRAG_LOAD_ERROR, fatal: false, frag: context.frag, response: response});
  }

  loadtimeout(stats, context) {
    let loader = context.loader;
    if (loader) {
      loader.abort();
    }
    this.loaders[context.type] = undefined;
    this.hls.trigger(Event.ERROR, {type: ErrorTypes.NETWORK_ERROR, details: ErrorDetails.FRAG_LOAD_TIMEOUT, fatal: false, frag: context.frag});
  }

  loadprogress(stats, context) {
    let frag = context.frag;
    frag.loaded = stats.loaded;
    this.hls.trigger(Event.FRAG_LOAD_PROGRESS, {frag: frag, stats: stats});
  }
}

export default FragmentLoader;
