'use strict';
const log = require('./log');
const Events = require('events');
const request = require('./request');
const { host } = require('../config');

module.exports = class Huobi extends Events {

    constructor() {
        super();
        this.size = 30;
        this.init();
    }

    async init() {
        try {
            console.log('init');
            await this.load_symbols();
            await this.load_symbols_kline();
        }
        catch (err) {
            this.init();
        }
    }

    async load_symbols() {
        // TODO
        // this.symbols = ['a', 'b', 'c', 'd'];

        const symbols = new Set();
        const rets = await request.send({ host: host, path: '/v1/common/symbols' });
        rets.data.forEach((symbol) => symbols.add(symbol['base-currency']));
        this.symbols = [...symbols].sort((a, b) => {
            if (a > b) return 1;
            else return - 1;
        });
    }

    async fetch_btc_in_usdt() {
        const ret = await request.send({
            host: host
            , path: '/market/history/kline'
            , qs: {
                period: '1min'
                , size: this.size
                , symbol: 'btcusdt'
            }
        });

        return ret.data.map((datum) => datum.close);
    }

    async fetch_eth_in_usdt() {
        const ret = await request.send({
            host: host
            , path: '/market/history/kline'
            , qs: {
                period: '1min'
                , size: this.size
                , symbol: 'ethusdt'
            }
        });

        return ret.data.map((datum) => datum.close);
    }

    async fetch_usdt_in_usdt() {
        return new Array(this.size).fill(1);
    }

    async load_symbols_kline() {
        try {
            console.time('task');
            const btc_usdt = await this.fetch_btc_in_usdt();
            const eth_usdt = await this.fetch_eth_in_usdt();
            const usdt_usdt = await this.fetch_usdt_in_usdt();

            for (let symbol of this.symbols) {
                try {
                    const statistics_05 = new Array(6).fill(0);
                    const statistics_10 = new Array(6).fill(0);
                    const statistics_15 = new Array(6).fill(0);
                    const statistics_30 = new Array(6).fill(0);

                    const promises = this.yield_opt(symbol).map((task) => request.send(task));
                    const symbol_results = await Promise.all(promises);

                    symbol_results.forEach((kline_result, index) => {
                        if (Array.isArray(kline_result)) {
                            let total_05 = 0;
                            let total_10 = 0;
                            let total_15 = 0;
                            let total_30 = 0;

                            let multipl;
                            if (index === 0) multipl = btc_usdt;
                            else if (index === 1) multipl = eth_usdt;
                            else multipl = usdt_usdt;

                            kline_result.forEach((datum, i) => {
                                if (i >= 25) total_05 += datum.vol * multipl[index];
                                if (i >= 20) total_10 += datum.vol * multipl[index];
                                if (i >= 15) total_15 += datum.vol * multipl[index];
                                total_30 += datum.vol * multipl[index];
                            });

                            let offset;
                            if (index === 0) offset = 1;
                            else if (index === 1) offset = 2;
                            else offset = 3;

                            statistics_05[offset] = Number((total_05 / 10000).toFixed(1));
                            statistics_10[offset] = Number((total_10 / 10000).toFixed(1));
                            statistics_15[offset] = Number((total_15 / 10000).toFixed(1));
                            statistics_30[offset] = Number((total_30 / 10000).toFixed(1));
                        }
                    });

                    {
                        statistics_05[0] = symbol;
                        statistics_10[0] = symbol;
                        statistics_15[0] = symbol;
                        statistics_30[0] = symbol;

                        statistics_05[4] = Number((statistics_05[1] + statistics_05[2] + statistics_05[3]).toFixed(1));
                        statistics_10[4] = Number((statistics_10[1] + statistics_10[2] + statistics_10[3]).toFixed(1));
                        statistics_15[4] = Number((statistics_15[1] + statistics_15[2] + statistics_15[3]).toFixed(1));
                        statistics_30[4] = Number((statistics_30[1] + statistics_30[2] + statistics_30[3]).toFixed(1));

                        const ts = Date.now();
                        statistics_05[5] = ts;
                        statistics_10[5] = ts;
                        statistics_15[5] = ts;
                        statistics_30[5] = ts;
                    }

                    console.log(`${new Date().toISOString()} ${symbol} ${statistics_05.join(', ')}`);

                    this.emit('kline', {
                        symbol: symbol
                        , '05': statistics_05
                        , '10': statistics_10
                        , '15': statistics_15
                        , '30': statistics_30
                    });
                }
                catch (err) {
                    log.info({ lv: 'ERROR', message: err.message, desc: symbol });
                }
            }
        }
        catch (err) {
            log.info({ lv: 'ERROR', message: err.message, desc: 'load_symbols_kline' });
        }
        finally {
            setTimeout(this.load_symbols_kline.bind(this), 1000);
        }
    }

    yield_opt(symbol) {
        return ['btc', 'eth', 'usdt'].map((platform) => {
            return {
                host: host
                , path: '/market/history/kline'
                , qs: {
                    period: '1min'
                    , size: this.size
                    , symbol: `${symbol}${platform}`
                }
            }
        });
    }

    randow_data(seed) {
        return [
            Math.floor(Math.random() * 100)
            , Math.floor(Math.random() * 200)
            , Math.floor(Math.random() * 300)
            , Math.floor(Math.random() * seed)
            , Date.now()
        ]
    }
}