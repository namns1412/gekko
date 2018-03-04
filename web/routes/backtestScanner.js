const _ = require('lodash');
const _set = require('lodash.set');
const _sum = require('lodash.sum');
const bluebird = require('bluebird');
const pipelineRunner = bluebird.promisify(require('../../core/workers/pipeline/parent'));
const baseConfig = require('./baseConfig');
const log = require('../../core/log');
const fs = require('fs');


function generateConfigs(configs) {
  // start all index is 0
  var results = [];

  var loop = (idx) => {
    if (idx >= configs.length) return;

    var config = configs[idx];
    if (config.current == undefined) {
      config.current = config.start;
    };

    while (config.current <= config.stop + config.step) {
      results.push(dumpConfig(configs));
      config.current += config.step;
      loop(idx + 1);
    }
    config.current = config.start;
  };
  loop(0);
  return results;
}

function dumpConfig(configs) {
  var result = {};
  for (var index = 0; index < configs.length; index++) {
    var config = configs[index];
    if (config.current == undefined) {
      config.current = config.start;
    }
    _set(result, config.key, config.current);
  }
  return result;
}

////////////////////// CONFIG
const settings = [{
    key: "CCI.constant",
    start: 0.01,
    stop: 0.02,
    step: 0.001
  },
  {
    key: "RSI.thresholds.up",
    start: 50,
    stop: 150,
    step: 5
  },
  {
    key: "RSI.thresholds.down",
    start: -150,
    stop: 50,
    step: 5
  },
  // {
  //   key: "RSI.thresholds.persistence",
  //   start: 0,
  //   stop: 2,
  //   step: 1
  // },
];

const gekkoConfig = {
  "watch": {
    "exchange": "binance",
    "currency": "BNB",
    "asset": "VEN"
  },
  "paperTrader": {
    "feeMaker": 0.25,
    "feeTaker": 0.25,
    "feeUsing": "maker",
    "slippage": 0.05,
    "simulationBalance": {
      "asset": 1,
      "currency": 100
    },
    "reportRoundtrips": true,
    "enabled": true
  },
  "tradingAdvisor": {
    "enabled": true,
    "method": "CCI",
    "candleSize": 3,
    "historySize": 10
  },
  "CCI": {
    "constant": 0.013,
    "history": 90,
    "thresholds": {
      "up": 100,
      "down": -200,
      "persistence": 1
    }
  },
  "backtest": {
    "daterange": {
      "from": "2017-11-15T16:35:00Z",
      "to": "2018-02-16T15:52:00Z"
    }
  },
  "performanceAnalyzer": {
    "riskFreeReturn": 2,
    "enabled": true
  },
  "valid": true
};

module.exports = async function () {
  // run
  var configs = generateConfigs(settings);

  // calculate
  console.log(configs.length);

  // back test
  var results = await bluebird.map(configs, async function (strategy) {
    var strategyConfig = {};
    _.merge(strategyConfig, gekkoConfig, strategy);

    var config = {};
    _.merge(config, baseConfig, strategyConfig);

    // run back test
    log.info("Running config", strategy);
    var result = await pipelineRunner('backtest', config);

    var profits = _.map(result.roundtrips, (trip) => trip.profit);
    var profit = _sum(profits) / profits.length * 100;

    return {
      strategy,
      profit
    };
  }, {
    concurrency: 3
  });

  results = _.sortBy(results, ['profit']);
  console.log(results);

  fs.writeFileSync('./backtest.result.js', JSON.stringify(results), 'utf8');

  this.body = results;
}
