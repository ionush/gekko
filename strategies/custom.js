// This is a basic example strategy for Gekko.
// For more information on everything please refer
// to this document:
//
// https://gekko.wizb.it/docs/strategies/creating_a_strategy.html
//
// The example below is pretty bad investment advice: on every new candle there is
// a 10% chance it will recommend to change your position (to either
// long or short).

var log = require('../core/log');
const util = require('util');

// Let's create our own strat
var strat = {};

//Create find inflection function

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
  var middleVal = sample[middle].low;
  // console.log('mmm', middleVal);

  //verify values to left of middle are increasing
  for (let i = middle - 1; i >= 0; i--) {
    if (sample[i].low < sample[i + 1].low) followTrend = false;
  }

  //verify values to right of middle are increasing
  for (let j = middle + 1; j < range; j++) {
    if (sample[j].low < sample[j - 1].low) followTrend = false;
  }

  if (followTrend) return sample[middle];
};

// Prepare everything our method needs
strat.init = function() {
  this.input = 'candle';
  this.currentTrend = null;
  this.requiredHistory = 0;

  this.historicalClose = [];
  this.inflectionPoints = [];
};

// What happens on every new candle?
strat.update = function(candle) {
  // console.log('singleCandle', candle);
  //add close data to to array
  this.historicalClose.push({
    low: this.candle.low,
    close: this.candle.close,
    volume: this.candle.volume,
    time: this.candle.start,
  });

  const result = findInflection(3, this.historicalClose, candle);
  if (result) {
    this.inflectionPoints.push(result);
    // if (this.currentTrend === null || this.currentTrend === 'short') {
    //   this.advice('long');
    //   this.currentTrend = 'long';
    // } else {
    //   this.advice('short');
    //   this.currentTrend = 'short';
    // }
  }

  // Get a random number between 0 and 1.
  // this.randomNumber = Math.random();

  // There is a 10% chance it is smaller than 0.1
  // this.toUpdate = this.randomNumber < 0.1;
};

// For debugging purposes.
// strat.log = function() {
//   log.debug('calculated random number:');
//   log.debug('\t', this.randomNumber.toFixed(3));
// };

// Based on the newly calculated
// information, check if we should
// update or not.
strat.check = function() {
  // Only continue if we have a new update.
  if (!this.toUpdate) return;

  // if (this.currentTrend === 'long') {
  //   // If it was long, set it to short
  //   this.currentTrend = 'short';
  //   this.advice('short');
  // } else {
  //   // If it was short, set it to long
  //   this.currentTrend = 'long';
  //   this.advice('long');
  // }
};

strat.end = function() {
  //print collated historical data
  // console.log('historical data');
  // console.log(util.inspect(this.historicalClose, { maxArrayLength: null }));
  // console.log('inflections', this.inflectionPoints);
};

module.exports = strat;
