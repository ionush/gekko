<template lang='pug'>
  div
    .hr.contain
    div.contain
      h3 Backtest result
    result-summary(:report='result.performanceReport')
    .hr.contain
    stockChart(:data='chartData')
    .hr.contain
    roundtripTable(:roundtrips='result.roundtrips')
</template>

<script>
import resultSummary from './summary.vue';
import stockChart from './stockChart'
import roundtripTable from './roundtripTable.vue';

export default {
  props: ['result'],
  data: () => {
    return {}
  },
  methods: {},
  components: {
    roundtripTable,
    resultSummary,
    stockChart,
  },
  computed: {
    chartData: function () {
      this.result.inflections.forEach(e => e.color = e.type === "support" ? 'aqua' : 'orange')
      this.result.trades.forEach(e => {
        e.y = e.price
        e.x = e.date * 1000
        e.title = e.action === "buy" ? 'B' : "S"
        e.text = `<span>Cost:${e.cost.toFixed(4)}<br>Amount:${e.amount.toFixed(4)}</span>`
      })
      console.log('inChartData', this.result)
      return {
        candles: this.result.stratCandles,
        trades: this.result.trades,
        inflections: this.result.inflections,
        closeLine: this.result.closeLine
      };
    },
  },
};
</script>

<style>
</style>
