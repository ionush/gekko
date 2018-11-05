<template lang='pug'>
#chartWrapper(v-bind:class='{ clickable: !isClicked }')
  .shield(v-on:click.prevent='click')
  svg#chart(width='960', :height='height')
//- div
//-   highcharts(class="stock" :constructor-type="'stockChart'" :options="chartOptions" )

</template>

<script>
// import chart from '../../../d3/chart4';

import {
  draw as drawMessage,
  clear as clearMessage,
} from '../../../d3/message';

const MIN_CANDLES = 4;

export default {
  props: ['data', 'height'],

  data: function () {
    return {
      isClicked: false,
      stockOptions: {
        rangeSelector: {
          selected: 1
        },
        title: {
          text: 'AAPL Stock Price'
        },
        series: [{
          name: 'AAPL',
          data: [10, 20, 10, 23, 65, 121, 44, 66, 98, 30, 32, 56, 25, 12, 53],
          pointStart: Date.UTC(2018, 1, 1),
          pointInterval: 1000 * 3600 * 24,
          tooltip: {
            valueDecimals: 2
          }
        }]
      }
    };
  },

  watch: {
    data: function () {
      this.render();
    },
  },

  created: function () {
    setTimeout(this.render, 100);
  },
  beforeDestroy: function () {
    this.remove();
  },

  methods: {
    click: function () {
      this.isClicked = true;
    },
    render: function () {
      this.remove();

      if (_.size(this.data.candles) < MIN_CANDLES) {
        drawMessage('Not enough data to spawn chart');
      } else {
        chart(
          this.data.candles,
          this.data.trades,
          this.height,
          this.data.inflections
        );
      }
    },
    remove: function () {
      d3.select('#chart').html('');
    },
  },
};
</script>

<style >
.stock {
  width: 70%;
  margin: 0 auto;
}

#chartWrapper.clickable {
  position: relative;
}

#chartWrapper.clickable .shield {
  cursor: zoom-in;
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  background: grey;
  opacity: 0.1;
}

#chart {
  background-color: #eee;
  width: 100%;
}

#chart circle {
  clip-path: url(#clip);
}

#chart cross {
  clip-path: url(#clip);
}

#chart .zoom {
  cursor: move;
  fill: none;
  pointer-events: all;
}

#chart .line {
  fill: none;
  stroke: steelblue;
  stroke-width: 1.5px;
  clip-path: url(#clip);
}

/*#chart .price.line {
  stroke-width: 2.5px;
}*/

#chart circle.buy {
  fill: #7fff00;
}

#chart circle.sell {
  fill: red;
}

#chart cross.v {
  fill: orange;
}

/* #chart circle.v {
  fill: orange;
} */
#chart circle.support {
  fill: orange;
}

/* #chart circle.n {
  fill: aqua;
} */

#chart circle.resistance {
  fill: aqua;
}
</style>
