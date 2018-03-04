/*

  RSI - cykedev 14/02/2014

  (updated a couple of times since, check git history)

 */
// helpers
var _ = require('lodash');
var log = require('../core/log.js');

// let's create our own method
var method = {
  setLossLock: function (candle, thresholds) {
    this.trend.lossLock = candle.start._i + thresholds.lossLock * 60 * 60 * 1000;
  },
  isLossLock: function (candle) {
    if (this.trend.lossLock && this.trend.lossLock >= candle.start._i) {
      log.debug("Loss locked until:", new Date(this.trend.lossLock).toISOString(),
        "current:", new Date(candle.start._i).toISOString());
      return true;
    }
    return false;
  }
};

// prepare everything our method needs
method.init = function () {
  this.name = 'RSI Intelligent';

  this.trend = {
    direction: 'none',
    duration: 0,
    persisted: false,
    adviced: false,
    price: 0
  };

  this.requiredHistory = this.tradingAdvisor.historySize;

  // define the indicators we need
  this.addTulipIndicator('rsi', 'rsi', this.settings.rsi);
}

// for debugging purposes log the last
// calculated parameters.
method.log = function (candle) {
  // var digits = 8;
  // var rsi = this.tulipIndicators.rsi.result;

  // log.debug('calculated RSI properties for candle:');
  // log.debug('\t', 'rsi:', rsi.result.toFixed(digits));
  // log.debug('\t', 'price:', candle.close.toFixed(digits));
  // log.debug(candle.start.format(), candle.start._i);
}

method.check = function (candle) {
  var rsi = this.tulipIndicators.rsi.result;
  var rsiVal = rsi.result;
  var thresholds = this.settings.thresholds;

  if (this.isLossLock(candle)) {
    this.advice();
    return;
  }

  // stop loss under stop setting
  if (this.trend.price > 0) {
    var stopLoss = thresholds.stopLoss || 2;
    var stopPrice = this.trend.price - (this.trend.price * stopLoss / 100);
    if (candle.close <= stopPrice) {
      log.debug("Stop loss at: ", stopLoss, stopPrice, candle.close);
      this.setLossLock(candle, thresholds);

      this.trend.adviced = true;
      this.trend.price = 0;
      this.advice('short');
      return;
    }
  }

  if (rsiVal > thresholds.high) {

    // new trend detected
    if (this.trend.direction !== 'high')
      this.trend = {
        duration: 0,
        persisted: false,
        direction: 'high',
        adviced: false,
        price: 0
      };

    this.trend.duration++;

    // log.debug('In high since', this.trend.duration, 'candle(s)');

    if (this.trend.duration >= thresholds.persistence)
      this.trend.persisted = true;

    if (this.trend.persisted && !this.trend.adviced) {
      // if (candle.close < this.trend.price) {
      //   this.setLossLock(candle, thresholds);
      // }

      this.trend.adviced = true;
      this.advice('short');
    } else
      this.advice();

  } else if (rsiVal < thresholds.low) {

    // new trend detected
    if (this.trend.direction !== 'low')
      this.trend = {
        duration: 0,
        persisted: false,
        direction: 'low',
        adviced: false,
        price: 0
      };

    this.trend.duration++;

    // log.debug('In low since', this.trend.duration, 'candle(s)');

    if (this.trend.duration >= thresholds.persistence)
      this.trend.persisted = true;

    if (this.trend.persisted && !this.trend.adviced) {
      this.trend.adviced = true;
      this.trend.price = candle.close;
      this.advice('long');
    } else
      this.advice();

  } else {
    // log.debug('In no trend');
    this.advice();
  }
}

module.exports = method;
