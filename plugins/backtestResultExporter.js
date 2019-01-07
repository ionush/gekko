// Small plugin that subscribes to some events, stores
// them and sends it to the parent process.

const log = require('../core/log');
const _ = require('lodash');
const util = require('../core/util.js');
const env = util.gekkoEnv();
const config = util.getConfig();
const moment = require('moment');
const fs = require('fs');
const json2csv = require('json2csv').parse;

const BacktestResultExporter = function() {
  this.performanceReport;
  this.roundtrips = [];
  this.stratUpdates = [];
  this.stratCandles = [];
  this.trades = [];
  this.inflections = [];
  this.closeLine = [];

  this.candleProps = config.backtestResultExporter.data.stratCandleProps;

  if (!config.backtestResultExporter.data.inflections) this.processInflection = null;

  if (!config.backtestResultExporter.data.stratUpdates) this.processStratUpdate = null;

  if (!config.backtestResultExporter.data.roundtrips) this.processRoundtrip = null;

  if (!config.backtestResultExporter.data.stratCandles) this.processStratCandles = null;

  if (!config.backtestResultExporter.data.portfolioValues) this.processPortfolioValueChange = null;

  if (!config.backtestResultExporter.data.trades) this.processTradeCompleted = null;

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
  let followVTrend = true;
  let followNTrend = true;
  const sample = store.slice(store.length - range, store.length);

  //support & resistance
  //verify values to left of middle are increasing
  //verify values to left of middle are decreasing
  for (let i = middle - 1; i >= 0; i--) {
    if (sample[i].low <= sample[i + 1].low) followVTrend = false;
    if (sample[i].high >= sample[i + 1].high) followNTrend = false;
  }

  //verify values to right of middle are increasing
  //verify values to right of middle are decreasing
  for (let j = middle + 1; j < range; j++) {
    if (sample[j].low <= sample[j - 1].low) followVTrend = false;
    if (sample[j].high >= sample[j - 1].high) followNTrend = false;
  }

  const { open, close, x, high, volume, low, close: y } = sample[middle];

  // if (followVTrend && followNTrend)
  //   return [
  //     { type: 'v', date: sample[middle].start, open, close, high, volume, low },
  //     { type: 'n', date: sample[middle].start, open, close, high, volume, low },
  //   ];

  if (followVTrend) return { type: 'support', x, open, close, high, volume, low, y };

  if (followNTrend) return { type: 'resistance', x, open, close, high, volume, low, y };
};

BacktestResultExporter.prototype.processInflection = function(inflection) {
  // this.inflections.push({ type: inflection.type, close: inflection.close });
};

BacktestResultExporter.prototype.processPortfolioValueChange = function(portfolio) {
  this.portfolioValue = portfolio.balance;
};

BacktestResultExporter.prototype.processStratCandle = function(candle) {
  const result = findInflection(3, this.stratCandles, candle);
  // console.log('configg', config.backtestResultExporter.data);

  // if (result && result.length === 2) {
  // this.inflections.push(...result);
  // } else
  if (result) this.inflections.push(result);

  let strippedCandle;

  this.closeLine.push({ x: candle.start.valueOf(), close: candle.close, y: candle.close });

  // console.log('timeeee', candle.start);

  if (!this.candleProps) {
    strippedCandle = {
      ...candle,
      // x: candle.start.unix(),
      x: candle.start.valueOf(),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      y: candle.close,
    };
  } else {
    strippedCandle = {
      ..._.pick(candle, this.candleProps),
      // x: candle.start.unix(),
      x: candle.start.valueOf(),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      y: candle.close,
    };
  }

  if (config.backtestResultExporter.data.portfolioValues) strippedCandle.portfolioValue = this.portfolioValue;

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

BacktestResultExporter.prototype.processPerformanceReport = function(performanceReport) {
  this.performanceReport = performanceReport;
};

BacktestResultExporter.prototype.finalize = function(done) {
  const backtest = {
    performanceReport: this.performanceReport,
  };

  if (config.backtestResultExporter.data.stratUpdates) backtest.stratUpdates = this.stratUpdates;

  if (config.backtestResultExporter.data.roundtrips) backtest.roundtrips = this.roundtrips;

  if (config.backtestResultExporter.data.stratCandles) backtest.stratCandles = this.stratCandles;

  if (config.backtestResultExporter.data.trades) backtest.trades = this.trades;

  if (config.backtestResultExporter.data.inflections) backtest.inflections = this.inflections;

  if (config.backtestResultExporter.data.closeLine) backtest.closeLine = this.closeLine;

  if (env === 'child-process') {
    process.send({ backtest });
  }

  const csvInflectionFields = ['type', 'x', 'open', 'close', 'high', 'low', 'volume'];
  const csvCandlesFields = ['x', 'open', 'close', 'high', 'low', 'volume'];
  const optsI = { fields: csvInflectionFields };
  const optsC = { fields: csvCandlesFields };
  // console.log('candles', this.stratCandles);
  try {
    const inflections = json2csv(this.inflections, optsI);
    const candles = json2csv(this.stratCandles, optsC);
    console.log('csv', inflections);
    this.writeToDisk(candles, () => {}, 'candles');
    this.writeToDisk(inflections, () => {}, 'inflections');
  } catch (e) {
    console.log('error parsing csv', e);
  }

  if (config.backtestResultExporter.writeToDisk) {
    this.writeToDisk(backtest, done);
  } else {
    done();
  }
};

BacktestResultExporter.prototype.writeToDisk = function(backtest, next, section) {
  const now = moment().format('YYYY-MM-DD_HH-mm-ss');
  let filename;
  if (section) filename = `${section}-backtest-${config.tradingAdvisor.method}-${now}.csv`;
  else filename = `backtest-${config.tradingAdvisor.method}-${now}.json`;
  const fsParseState = filename.includes('.csv') ? backtest : JSON.stringify(backtest);
  fs.writeFile(util.dirs().output + filename, fsParseState, err => {
    if (err) {
      log.error('unable to write backtest result', err);
    } else {
      log.info('written backtest to: ', util.dirs().gekko + filename);
    }

    next();
  });
};

module.exports = BacktestResultExporter;
