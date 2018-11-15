'use strict';

const Alexa = require('alexa-sdk');
const https = require('https');
const axios = require('axios');

const APP_ID = 'amzn1.ask.skill.9c6d229c-0a6b-46f7-a802-42f04f5e3043';
const LAUNCH_MESSAGE = 'Welcome to My Stox! How can I help?';
const API_KEY = 'mN-TV7k1sQQ9kdfCKVSV';

const handlers = {
    'LaunchRequest': function () {
        this.emit(':ask', LAUNCH_MESSAGE);
    },
    'GetSentiment': function (){
        this.emit(':tell', 'The sentiment is good based on the release of a new GPU');
    },
    'GetPortfolioPerformance': function(){
        let internalApiUrl = 'http://ec2-54-91-248-174.compute-1.amazonaws.com/api/v1/stocks';
        let stocks = []
        axios.get(internalApiUrl)
            .then(res => {
                stocks = res.data.results;
                let totalInitialValue = 0;
                stocks.forEach(stock => {
                    totalInitialValue += stock['NumberOfShares'] * stock['PurchasePrice'];
                });
                //console.log(stocks);
                let metadataUrl = 'https://www.quandl.com/api/v3/datasets/WIKI/GOOGL/metadata.json?api_key=' + API_KEY;
                let totalFinalValue = 0;
                axios.get(metadataUrl).then(res => {
                    // TODO - Wrap in a try catch
                    let date = res.data["dataset"]["newest_available_date"];

                    let promises = stocks.map(stock => {
                        let stockQuoteUrl = 'https://www.quandl.com/api/v3/datasets/WIKI/' + stock['Ticker'] + '/data.json?start_date=' + date + '&api_key=' + API_KEY;
                        return axios.get(stockQuoteUrl);
                    });

                    return Promise.all(promises);

                }).then(responses => {
                    responses.forEach((res, index) => {
                        let close = res.data["dataset_data"]["data"][0][4];
                        totalFinalValue += (close * stocks[index]['NumberOfShares']);
                    });
                    let percentChange = 100.0 * ((totalFinalValue - totalInitialValue) / totalInitialValue);
                    if(percentChange > 0){
                        this.emit(':tell', 'Your portfolio is up ' + percentChange.toPrecision(4).toString() + ' percent overall.');
                    }
                    else{
                        this.emit(':tell', 'Your portfolio is down ' + Math.abs(percentChange).toPrecision(4).toString() + ' percent overall.');
                    }
                }).catch(error =>{
                    console.log(error);
                    this.emit(':tell', 'Something went wrong. Please try asking again!');
                });
            })
            .catch(error => {
                console.log(error);
            });

    },
    'GetStocks': function(){

        // GET /stocks/ #get all the stocks
        // POST /stocks/ #add a new stock
        // PUT /stocks/ [{}, {}, {}]
        // PUT/PATCH /stocks/<ticker>/ #modify an existing stock {a: 1, b: 2} -> {a: 1, b:2}     {a:3} -> a:3, b:2
        // DELETE /stocks/<ticker>/ #delete a stock
        let internalApiUrl = 'http://ec2-54-91-248-174.compute-1.amazonaws.com/api/v1/stocks';
        let stocks = []

        axios.get(internalApiUrl).then(res => {
            stocks = res.data.results;
            let metadataUrl = 'https://www.quandl.com/api/v3/datasets/WIKI/GOOGL/metadata.json?api_key=' + API_KEY;

            axios.get(metadataUrl).then(res => {
                // TODO - Wrap in a try catch
                let date = res.data["dataset"]["newest_available_date"];

                let promises = stocks.map(stock => {
                    let stockQuoteUrl = 'https://www.quandl.com/api/v3/datasets/WIKI/' + stock['Ticker'] + '/data.json?start_date=' + date + '&api_key=' + API_KEY;
                    return axios.get(stockQuoteUrl);
                });

                return Promise.all(promises);

            }).then(responses => {

                let toEmit = "";

                responses.forEach((res, index) => {
                    let open = res.data["dataset_data"]["data"][0][1];
                    let close = res.data["dataset_data"]["data"][0][4];
                    toEmit += emitString(stocks[index]['Name'], open, close);
                });

                this.emit(':tell', toEmit);

            }).catch(error => {
                console.log(error);
                this.emit(':tell', 'Something went wrong. Please try again');
            }); // Responses from quotes
        }).catch(error => {
            console.log(error);
            this.emit(':tell', 'Something went wrong. Please try again');
        });
    },
    'AMAZON.HelpIntent': function () {
        const speechOutput = this.t('HELP_MESSAGE');
        const reprompt = this.t('HELP_MESSAGE');
        this.emit(':ask', speechOutput, reprompt);
    },
    'AMAZON.CancelIntent': function () {
        this.emit(':tell', this.t('STOP_MESSAGE'));
    },
    'AMAZON.StopIntent': function () {
        this.emit(':tell', this.t('STOP_MESSAGE'));
    },
};

exports.handler = function (event, context) {
    const alexa = Alexa.handler(event, context);
    alexa.APP_ID = APP_ID;
    alexa.registerHandlers(handlers);
    alexa.execute();
};
function emitString(stock, open, close){
	let str = stock + ' opened at ' + formatDollars(open) + ' and ' + formatCents(open) + ' and closed at ' + formatDollars(close) + ' and ' + formatCents(close) + '. ';
	let percentage = ((close - open) / open) * 100.0;
	percentage = percentage.toFixed(2);
	if(percentage < 0){
		str = str + "Down " + Math.abs(percentage).toString() + " percent. ";
	}
	else{
		str = str + "Up " + Math.abs(percentage).toString() + " percent. ";
	}
	return str;
}
function formatDollars(cost){
    const indexOfDecimal = cost.toString().indexOf('.');
    if(indexOfDecimal == -1){
        return cost.toString() + ' dollars';
    }
    let formatted = cost.toString().substring(0, indexOfDecimal) + ' dollars';
    return formatted;
}
function formatCents(cost){
    const indexOfDecimal = cost.toString().indexOf('.');
    if(indexOfDecimal == -1){
        return '0 cents';
    }
    let formatted = cost.toString().substring(indexOfDecimal + 1, indexOfDecimal + 3) + ' cents';
    return formatted;
}
