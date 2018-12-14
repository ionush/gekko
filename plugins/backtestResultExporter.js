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
const timeseries = require('timeseries-analysis');

const BacktestResultExporter = function() {
  this.performanceReport;
  this.roundtrips = [];
  this.stratUpdates = [];
  this.stratCandles = [];
  this.trades = [];
  this.inflections = [];
  this.inflectionLength = undefined;
  this.closeLine = [];
  this.regression = [];
  this.bounces = [];

  this.candleProps = config.backtestResultExporter.data.stratCandleProps;

  // if (!config.backtestResultExporter.data.inflections) this.processInflection = null;

  if (!config.backtestResultExporter.data.stratUpdates) this.processStratUpdate = null;

  if (!config.backtestResultExporter.data.roundtrips) this.processRoundtrip = null;

  if (!config.backtestResultExporter.data.stratCandles) this.processStratCandles = null;

  if (!config.backtestResultExporter.data.portfolioValues) this.processPortfolioValueChange = null;

  if (!config.backtestResultExporter.data.trades) this.processTradeCompleted = null;

  _.bindAll(this);
};

const findInflection = function(range, store) {
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
  for (let i = middle - 1; i >= 0; i--) {
    //verify values to left of middle are increasing
    if (sample[i].low <= sample[i + 1].low) followVTrend = false;
    //verify values to left of middle are decreasing
    if (sample[i].high >= sample[i + 1].high) followNTrend = false;
  }

  for (let j = middle + 1; j < range; j++) {
    //verify values to right of middle are increasing
    if (sample[j].low <= sample[j - 1].low) followVTrend = false;
    //verify values to right of middle are decreasing
    if (sample[j].high >= sample[j - 1].high) followNTrend = false;
  }

  const { open, close, x, high, volume, low, close: y } = sample[middle];

  if (followVTrend && followNTrend)
    return [
      { type: 'support', x, open, close, high, volume, low, y },
      { type: 'resistance', x, open, close, high, volume, low, y },
    ];

  if (followVTrend) return { type: 'support', x, open, close, high, volume, low, y };

  if (followNTrend) return { type: 'resistance', x, open, close, high, volume, low, y };
};

const calcRegression = (forecastPoints, store) => {
  const sampleSize = store.length - forecastPoints;

  if (sampleSize < 10) return;
  const t = new timeseries.main(
    timeseries.adapter.fromDB(store, {
      date: 'x',
      value: 'close',
    })
  );
  const regression = t.sliding_regression_forecast({ sample: sampleSize, degree: 5 }).output();
  return regression;
};

const calcBounces = inflections => {
  if (!inflections) return;
  if (this.inflectionLength === inflections.length) return;
  else this.inflectionLength = inflections.length;

  const bounces = [];
  for (let i = 0; i < inflections.length; i++) {
    if (inflections[i].type === 'support') {
      for (let j = i; j < inflections.length; j++) {
        if (
          inflections[j].type === 'resistance' &&
          inflections[j].x > inflections[i].x
          // &&
          // inflections[j].high > inflections[i].low
        ) {
          bounces.push([inflections[i], inflections[j]]);
          break;
        }
      }
    }
  }
  // console.log('bouncespree', bounces.length, bounces);
  const consolidated = consolidateBounces(bounces);
  // console.log('consolidatedd', consolidated);
  return consolidated;
};

const consolidateBounces = bounces => {
  const writeBounce = (bounces, consolidatedBounces, startIndex, i) => {
    const size = (bounces[i][1].high / bounces[startIndex][0].low - 1) * 100;
    const recency = bounces[startIndex][0].x;
    const duration = bounces[i][1].x - bounces[startIndex][0].x;
    consolidatedBounces.push({
      bounce: [bounces[i][0], bounces[startIndex][1]],
      size,
      recency,
      duration,
    });
  };

  if (bounces.length < 2) return;
  const consolidatedBounces = [];
  let startIndex = undefined;
  for (let i = 1; i < bounces.length; i++) {
    if (bounces[i][0].low >= bounces[i - 1][0].low && bounces[i][1].high >= bounces[i - 1][1].high) {
      console.log('foundbouncee', i, startIndex, bounces[i - 1]);
      if (!startIndex && i === bounces.length - 1) {
        startIndex = i - 1;
        writeBounce(bounces, consolidatedBounces, startIndex, i);
      } else if (!startIndex) startIndex = i - 1;
    } else if (startIndex) {
      console.log('writingbounce', i, startIndex);
      writeBounce(bounces, consolidatedBounces, startIndex, i - 1);
      startIndex = undefined;
    }
  }
  return consolidatedBounces;
};

// BacktestResultExporter.prototype.processInflection = function(inflection) {
//   // this.inflections.push({ type: inflection.type, close: inflection.close });
// };

BacktestResultExporter.prototype.processPortfolioValueChange = function(portfolio) {
  this.portfolioValue = portfolio.balance;
};

BacktestResultExporter.prototype.processStratCandle = function(candle) {
  const inflection = findInflection(3, this.stratCandles);
  if (Array.isArray(inflection)) this.inflections.push(...inflection);
  else if (inflection) this.inflections.push(inflection);

  const regression = calcRegression(30, this.stratCandles);
  if (regression) this.regression = regression;

  const bounces = calcBounces(this.inflections);
  if (bounces) this.bounces = bounces;

  // console.log('bouncesss', this.bounces);

  // console.log('configg', config.backtestResultExporter.data);

  let strippedCandle;

  this.closeLine.push({ x: candle.start.valueOf(), close: candle.close, y: candle.close });

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

  console.log('check resultexporter', config.backtestResultExporter.data);

  if (config.backtestResultExporter.data.stratUpdates) backtest.stratUpdates = this.stratUpdates;

  if (config.backtestResultExporter.data.roundtrips) backtest.roundtrips = this.roundtrips;

  if (config.backtestResultExporter.data.stratCandles) backtest.stratCandles = this.stratCandles;

  if (config.backtestResultExporter.data.trades) backtest.trades = this.trades;

  if (config.backtestResultExporter.data.inflections) backtest.inflections = this.inflections;

  if (config.backtestResultExporter.data.closeLine) backtest.closeLine = this.closeLine;

  if (config.backtestResultExporter.data.regression) backtest.regression = this.regression;

  if (config.backtestResultExporter.data.bounces) backtest.bounces = this.bounces;

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
    // console.log('csv', inflections);
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
