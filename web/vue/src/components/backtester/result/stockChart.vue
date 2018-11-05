
<template>
    <div class="row">
        <highcharts class="stock" :constructor-type="'stockChart'" :options="stockOptions"></highcharts>
    </div>
</template>

<script>

export default {
    props: ['data'],
    data() {
        console.log('inChartDataaa', this.data)
        return {
            stockOptions: {
                rangeSelector: {
                    // allButtonsEnabled: true,
                    selected: 10,
                    buttons: [{
                        type: 'hour',
                        count: 12,
                        text: '12h'
                    }, {
                        type: 'day',
                        count: 1,
                        text: '1d'
                    }, {
                        type: 'day',
                        count: 7,
                        text: '7d'
                    }, {
                        type: 'month',
                        count: 1,
                        text: '1m'
                    }, {
                        type: 'month',
                        count: 3,
                        text: '3m'
                    }, {
                        type: 'month',
                        count: 6,
                        text: '6m'
                    }, {
                        type: 'ytd',
                        text: 'YTD'
                    }, {
                        type: 'year',
                        count: 1,
                        text: '1y'
                    }, {
                        type: 'all',
                        text: 'All'
                    }]
                },
                plotOptions: {
                    series: { turboThreshold: 5000 }, //allow more data points
                    candlestick: {
                        color: 'red',
                        upColor: 'green'
                    },
                    flags: { useHTML: true }
                },
                chart: {
                    borderWidth: 5
                },
                yAxis: [{
                    title: {
                        text: 'OHLC'
                    },
                    lineWidth: 2,
                    height: '50%'
                },
                {
                    title: {
                        text: 'Analysis'
                    },
                    top: '50%',
                    offset: 0,
                    opposite: true,
                    lineWidth: 1,
                    height: '50%'
                }
                ],
                navigator: { enabled: true },

                title: {
                    text: 'Backtesting Results'
                },
                series: [{
                    name: 'BTC/USD',
                    type: 'candlestick',
                    data: this.data.candles,
                    groupPadding: 0,
                    lineWidth: 0.1,
                    dataGrouping: {
                        units: [
                            [
                                'hour', [1]
                            ],
                            [
                                'day', [1]
                            ],
                            [
                                'week', // unit name
                                [1] // allowed multiples
                            ], [
                                'month',
                                [1, 2, 3, 4, 6]
                            ]
                        ]
                    },
                    // pointStart: Date.UTC(2018, 1, 1),
                    // pointInterval: 1000 * 3600 * 24,
                    tooltip: {
                        valueDecimals: 2
                    }
                },
                {
                    name: 'BTC/USD',
                    yAxis: 1,
                    data: this.data.closeLine,
                    // pointStart: Date.UTC(2018, 1, 1),
                    // pointInterval: 1000 * 3600 * 24,
                    tooltip: {
                        valueDecimals: 2
                    }
                },
                {
                    enableMouseTracking: false, //remove tooltip
                    name: 'AAPL Stock Price',
                    yAxis: 1,
                    data: this.data.inflections,
                    lineWidth: 0,
                    marker: {
                        symbol: 'circle',
                        enabled: true,
                        radius: 3
                    },
                    states: {
                        hover: {
                            lineWidthPlus: 0
                        }
                    }
                },
                {
                    type: 'flags',
                    data: this.data.trades,
                    yAxis: 1
                }
                ]
            }
        }
    },
    watch: {
        chartData: function () {
            console.log('alaahahhhhhh!!!!')
        }
    }
}
</script>
<style scoped>
.stock {
  height: 100%;
  width: 100%;
  /* position: absolute; */
  /* margin: 0 auto; */
}

.row {
  height: 700px;
}
</style>