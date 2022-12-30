/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import moment from "moment";
import { BasicClient } from "../BasicClient";
import { Level2Point } from "../Level2Point";
import { Level2Update } from "../Level2Update";
import { NotImplementedFn } from "../NotImplementedFn";
import { Ticker } from "../Ticker";
import { Trade } from "../Trade";

export class CryptoComClient extends BasicClient {
    constructor() {
        super("wss://stream.crypto.com/v2/market", "CryptoCom", undefined, 60 * 1000);

        this.hasTrades = true;
        this.hasLevel2Updates = true;
    }

    protected _sendSubTicker = NotImplementedFn;
    protected _sendUnsubTicker = NotImplementedFn;

    protected _sendSubTrades(remote_id: string) {
        this._wss.send(
            JSON.stringify(
                {
                    id: 1,
                    method: "subscribe",
                    params: {
                        channels: [`trade.${remote_id}`]
                    }
                }

            ),
        );
    }

    protected _sendUnsubTrades(remote_id: string) {
        this._wss.send(
            JSON.stringify(
                {
                    id: 1,
                    method: "unsubscribe",
                    params: {
                        channels: [`trade.${remote_id}`]
                    }
                }),
        );
    }

    protected _sendSubLevel2Updates(remote_id: string) {
        this._wss.send(
            JSON.stringify({
                id: 1,
                method: "subscribe",
                params: {
                    channels: [`book.${remote_id}`]
                }
            }),
        );
    }

    protected _sendUnsubLevel2Updates(remote_id: string) {
        this._wss.send(
            JSON.stringify({
                id: 1,
                method: "unsubscribe",
                params: {
                    channels: [`book.${remote_id}`]
                }
            }),
        );
    }

    protected _sendSubCandles = NotImplementedFn;
    protected _sendUnsubCandles = NotImplementedFn;
    protected _sendSubLevel2Snapshots = NotImplementedFn;
    protected _sendUnsubLevel2Snapshots = NotImplementedFn;
    protected _sendSubLevel3Snapshots = NotImplementedFn;
    protected _sendUnsubLevel3Snapshots = NotImplementedFn;
    protected _sendSubLevel3Updates = NotImplementedFn;
    protected _sendUnsubLevel3Updates = NotImplementedFn;
    protected _sendUnsubscribe = NotImplementedFn;

    protected _onMessage(raw): void {
        try {
            const msg = JSON.parse(raw);

            if (msg.method === 'subscribe' && msg.result) {
                // trades
                if (msg.result.channel === "trade") {
                    const market = this._tradeSubs.get(msg.result.instrument_name);
                    if (!market) return;

                    this._onDealUpdate(msg.result.data, market);
                } else if (msg.result.channel === 'book') {
                    const market = this._level2UpdateSubs.get(msg.result.instrument_name);
                    if (!market) return;

                    this._onLevel2Update(msg.result.data, market);
                }
            } else if (msg.method === 'public/heartbeat') {
                this._onHeartbeat(msg.id);
            }


            // // l2updates
            // if (msg.channel === "push.depth") {

            //     this._onLevel2Update(msg.data, market);
            //     return;
            // }
        } catch (e) {
            throw new Error(e);
        }
    }

    protected _createTrade(update, market): Trade {
        let { id, quantity, takerSide, price, createTime } = update;
        price = Number(price).toFixed(8);
        quantity = Number(quantity).toFixed(8);

        return new Trade({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            tradeId: id,
            unix: moment(createTime).utc().valueOf(),
            side: takerSide,
            price,
            amount: quantity,
        });
    }

    protected _onHeartbeat(id) {
        this._wss.send(JSON.stringify({
            id,
            method: "public/respond-heartbeat"
        }))
    }

    protected _onLevel2Update(data, market): void {
        data.forEach(d => {
            const asks = d.asks?.map(ask => new Level2Point(ask[0], ask[1], ask[2])) ?? [];
            const bids = d.bids?.map(bid => new Level2Point(bid[0], bid[1], bid[2])) ?? [];
            const update = new Level2Update({
                exchange: this.name,
                base: market.base,
                quote: market.quote,
                asks,
                bids,
            });

            this.emit("l2update", update, market);
        });
    }

    protected _onDealUpdate(data, market) {
        data.forEach(deal => {
            const trade = new Trade({
                exchange: this.name,
                base: market.base,
                quote: market.quote,
                timestamp: deal.t,
                price: deal.p,
                side: deal.s.toLowerCase(),
                amount: deal.q,
                unix: moment(data.t).utc().valueOf(),
            });
            this.emit("trade", trade, market);
        });
    }
}
