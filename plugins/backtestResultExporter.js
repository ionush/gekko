// Small plugin that subscribes to some events, stores
// them and sends it to the parent process.

const log = require('../core/log');
const _ = require('lodash');
const util = require('../core/util.js');
const env = util.gekkoEnv();
const config = util.getConfig();
const moment = require('moment');
const fs = require('fs');

const BacktestResultExporter = function() {
  this.performanceReport;
  this.roundtrips = [];
  this.stratUpdates = [];
  this.stratCandles = [];
  this.trades = [];
  this.inflections = [];

  this.candleProps = config.backtestResultExporter.data.stratCandleProps;

  if (!config.backtestResultExporter.data.inflections)
    this.processInflection = null;

  if (!config.backtestResultExporter.data.stratUpdates)
    this.processStratUpdate = null;

  if (!config.backtestResultExporter.data.roundtrips)
    this.processRoundtrip = null;

  if (!config.backtestResultExporter.data.stratCandles)
    this.processStratCandles = null;

  if (!config.backtestResultExporter.data.portfolioValues)
    this.processPortfolioValueChange = null;

  if (!config.backtestResultExporter.data.trades)
    this.processTradeCompleted = null;

  _.bindAll(this);
};

const findInflection = function(range, store, candle) {
  if (range % 2 !== 1) {
    console.log('range must be odd number!');
    return;
  } else if (store.length < range) {
    console.log('not enough data points');
    return;
  }
  const middle = Math.floor(range / 2);
  // console.log('middle is', middle);
  const results = [];

  let followTrend = true;
  const sample = store.slice(store.length - range, store.length);

  //verify values to left of middle are increasing
  //TEMPORARILY USE OPEN VALUES INSTEAD OF LOW
  for (let i = middle - 1; i >= 0; i--) {
    if (sample[i].open < sample[i + 1].open) {
      followTrend = false;
    }
  }

  //verify values to right of middle are increasing
  for (let j = middle + 1; j < range; j++) {
    if (sample[j].open < sample[j - 1].open) followTrend = false;
  }

  if (followTrend) {
    return { open: sample[middle].open, date: sample[middle].start };
  }
};

BacktestResultExporter.prototype.processInflection = function(inflection) {
  // this.inflections.push({ type: inflection.type, close: inflection.close });
};

BacktestResultExporter.prototype.processPortfolioValueChange = function(
  portfolio
) {
  this.portfolioValue = portfolio.balance;
};

BacktestResultExporter.prototype.processStratCandle = function(candle) {
  const result = findInflection(5, this.stratCandles, candle);
  if (result)
    this.inflections.push({ type: 'v', open: result.open, date: result.date });

  let strippedCandle;

  if (!this.candleProps) {
    strippedCandle = {
      ...candle,
      start: candle.start.unix(),
    };
  } else {
    strippedCandle = {
      ..._.pick(candle, this.candleProps),
      start: candle.start.unix(),
    };
  }

  if (config.backtestResultExporter.data.portfolioValues)
    strippedCandle.portfolioValue = this.portfolioValue;

  this.stratCandles.push(strippedCandle);
};

BacktestResultExporter.prototype.processRoundtrip = function(roundtrip) {
  this.roundtrips.push({
    ...roundtrip,
    entryAt: roundtrip.entryAt.unix(),
    exitAt: roundtrip.exitAt.unix(),
  });
};

BacktestResultExporter.prototype.processTradeCompleted = function(trade) {
  this.trades.push({
    ...trade,
    date: trade.date.unix(),
  });
};

BacktestResultExporter.prototype.processStratUpdate = function(stratUpdate) {
  this.stratUpdates.push({
    ...stratUpdate,
    date: stratUpdate.date.unix(),
  });
};

BacktestResultExporter.prototype.processPerformanceReport = function(
  performanceReport
) {
  this.performanceReport = performanceReport;
};

BacktestResultExporter.prototype.finalize = function(done) {
  const backtest = {
    performanceReport: this.performanceReport,
  };

  if (config.backtestResultExporter.data.inflections)
    backtest.inflections = this.inflections;

  if (config.backtestResultExporter.data.stratUpdates)
    backtest.stratUpdates = this.stratUpdates;

  if (config.backtestResultExporter.data.roundtrips)
    backtest.roundtrips = this.roundtrips;

  if (config.backtestResultExporter.data.stratCandles)
    backtest.stratCandles = this.stratCandles;

  if (config.backtestResultExporter.data.trades) backtest.trades = this.trades;

  if (env === 'child-process') {
    process.send({ backtest });
  }

  if (config.backtestResultExporter.writeToDisk) {
    this.writeToDisk(backtest, done);
  } else {
    done();
  }
};

BacktestResultExporter.prototype.writeToDisk = function(backtest, next) {
  const now = moment().format('YYYY-MM-DD_HH-mm-ss');
  const filename = `backtest-${config.tradingAdvisor.method}-${now}.json`;
  fs.writeFile(util.dirs().gekko + filename, JSON.stringify(backtest), err => {
    if (err) {
      log.error('unable to write backtest result', err);
    } else {
      log.info('written backtest to: ', util.dirs().gekko + filename);
    }

    next();
  });
};

module.exports = BacktestResultExporter;
