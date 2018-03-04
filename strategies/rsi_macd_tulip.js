var _ = require('lodash');
var log = require('../core/log.js');

var RSI = require('./indicators/RSI.js');

// let's create our own method
var method = {};

// prepare everything our method needs
method.init = function () {
  this.name = 'RSI - MACD Tulip';

  this.trend = {
    direction: 'none',
    duration: 0,
    persisted: false,
    adviced: false,
    price: 0
  };

  this.requiredHistory = this.tradingAdvisor.historySize;

  // add MACD
  this.addTulipIndicator('macd', 'macd', this.settings.macd);

  // define the indicators we need
  this.addTulipIndicator('rsi', 'rsi', this.settings.rsi);
};

// for debugging purposes log the last
// calculated parameters.
method.log = function (candle) {
  //   var digits = 8;
  //   var macd = this.tulipIndicators.macd.result;
  //   var rsi = this.tulipIndicators.rsi.result;

  //   log.debug('calculated properties for candle:');
  //   log.debug('\t', 'price:', candle.close.toFixed(digits));
  //   if (macd.macd != undefined) {
  //     log.debug('\t', 'macd:', macd.macd.toFixed(digits));
  //     log.debug('\t', 'macdSignal:', macd.macdSignal.toFixed(digits));
  //     log.debug('\t', 'macdHistogram:', macd.macdHistogram.toFixed(digits));
  //   }
  //   if (rsi.result != undefined) {
  //     log.debug('\t', 'rsi:', rsi.result.toFixed(digits));
  //   }
}

method.check = function (candle) {
  var macd = this.tulipIndicators.macd.result;
  var rsi = this.tulipIndicators.rsi.result;

  var rsiVal = rsi.result;

  // trend is uptrend
  var thresholds = this.settings.downtrend;
  if (macd.macd > macd.macdSignal) {
    log.debug("MACD uptrend");
    thresholds = this.settings.uptrend;
  } else {
    if (this.trend.adviced) {
      this.trend.adviced = true;
      this.advice('short');
    } else {
      this.advice();
    }
    return;
  }

  // stop loss under stop setting
  if (this.trend.adviced && this.trend.price > 0) {
    var stopLoss = _.parseInt(thresholds.stopLoss) || 2;
    var stopPrice = this.trend.price - (this.trend.price * stopLoss / 100);
    if (candle.close < stopPrice) {
      log.debug("Stop loss at: ", stopLoss, stopPrice, candle.close);
      this.trend.price = 0;
      this.advice('short');
      return;
    }
  }


  // short on high rsi
  if (rsiVal > thresholds.high) {
    // new trend detected
    if (this.trend.direction !== 'high') {
      this.trend = {
        duration: 0,
        persisted: false,
        direction: 'high',
        adviced: false,
        price: 0
      };
    }

    this.trend.duration++;

    log.debug('In high since', this.trend.duration, 'candle(s)');

    if (this.trend.duration >= thresholds.persistence) {
      this.trend.persisted = true;
    }

    if (this.trend.persisted && !this.trend.adviced) {
      this.trend.adviced = true;
      this.advice('short');
      return;
    }
  }

  // long on low rsi
  if (rsiVal < thresholds.low) {
    // new trend detected
    if (this.trend.direction !== 'low') {
      this.trend = {
        duration: 0,
        persisted: false,
        direction: 'low',
        adviced: false,
        price: 0
      };
    }

    this.trend.duration++;

    log.debug('In low since', this.trend.duration, 'candle(s)');

    if (this.trend.duration >= thresholds.persistence) {
      this.trend.persisted = true;
    }

    if (this.trend.persisted && !this.trend.adviced) {
      this.trend.adviced = true;
      this.trend.price = candle.close;
      this.advice('long');
      return;
    }
  }

  // log.debug('In no trend');
  this.advice();
};

module.exports = method;
