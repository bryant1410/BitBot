var _ = require('underscore');
var mongo = require('mongojs');
var async = require('async');

//------------------------------Config
var config = require('../config.js');
//------------------------------Config

var db = function() {

	this.pair = config.exchangeSettings.currencyPair.pair;
	this.dbCollectionName = config.exchangeSettings.exchange + config.exchangeSettings.currencyPair.pair;

	_.bindAll(this, 'materialise', 'removeOldDBCandles', 'getDBCandles', 'getInitialBalance', 'setInitialBalance');

};

db.prototype.materialise = function(candleStickArray, callback) {

	var csDatastore = mongo(config.mongoConnectionString);
	var csCollection = csDatastore.collection(this.dbCollectionName);

	csCollection.find({volume: {$gt:0}}).sort({period:-1}).limit(1,function(err, sticks) {

		var filterPeriod = 0;

		if(!err && sticks.length > 0) {

			filterPeriod = sticks[0].period;

		}

		materialiseCs = _.filter(candleStickArray, function(cs){

			return cs.period >= filterPeriod;

		});

		if(materialiseCs.length > 0) {

			async.eachSeries(materialiseCs, function(cs, cb) {

				csCollection.update({period: cs.period}, cs, { upsert: true }, function(err, doc) {

					if(err) {

						cb(err);

					} else {

						cb();

					}

				});

			}, function(err) {

				csDatastore.close();

				if(err) {

					callback(err);

				} else {

					callback(null);

				}

			});

		} else {

			callback(null);

		}

	});

};

db.prototype.removeOldDBCandles = function(filterPeriod) {

	var csDatastore = mongo(config.mongoConnectionString);
	var csCollection = csDatastore.collection(this.dbCollectionName);

	csCollection.remove({ period: { $lte: filterPeriod } }, function(err, resp) {

		csDatastore.close();

	});

};

db.prototype.getDBCandles = function(callback) {

	var csDatastore = mongo(config.mongoConnectionString);
	var csCollection = csDatastore.collection(this.dbCollectionName);

	csCollection.ensureIndex({period: 1});

	csCollection.find({}).sort({period:1}, function(err, candleSticks) {

		csDatastore.close();

		if(err) {

			callback(err);

		} else if(candleSticks.length > 0 ){

			var storageCandleSticks = _.map(candleSticks, function(candleStick){
				return {'period':candleStick.period, 'open':candleStick.open, 'high':candleStick.high, 'low':candleStick.low, 'close':candleStick.close, 'volume':candleStick.volume, 'vwap':candleStick.vwap};
			});

			callback(null, storageCandleSticks);

		} else {

			callback(null);

		}

	}.bind(this));

};

db.prototype.getInitialBalance = function(callback) {

	var csDatastore = mongo(config.mongoConnectionString);
	var csCollection = csDatastore.collection('balance');

	csCollection.find({pair: this.pair}).limit(1, function(err, balance) {

		csDatastore.close();

		if(err) {

			callback(err);

		} else if(balance.length > 0 ){

			var initialBalance = balance[0].initialBalance;

			callback(null, initialBalance);

		} else {

			callback(null, null);

		}

	}.bind(this));

};

db.prototype.setInitialBalance = function(initialBalance, callback) {

	var csDatastore = mongo(config.mongoConnectionString);
	var csCollection = csDatastore.collection('balance');

	csCollection.update({pair: this.pair}, {pair: this.pair, initialBalance: initialBalance}, { upsert: true }, function(err, doc) {

		csDatastore.close();

		if(err) {

			callback(err);

		} else {

			callback(null);

		}

	}.bind(this));

};

var database = new db();

module.exports = database;