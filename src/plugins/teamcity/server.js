﻿var httpclient = require('../../../httpclient'),
  _ = require('lodash');

var exports = module.exports = {};

function teamCityRequest(datasource, url) {

  var gettingTeamCityData = new Promise(function (resolve, reject) {
    var requrl = datasource.url + 'app/rest/' + url;
    var headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };

    httpclient.get(requrl, datasource.auth, headers, datasource.timeout)
      .then(function (result) {
        resolve(result.body);
      })
      .catch(function (error) {
        console.log(util.format('TeamCity: %s: %s', datasource.id, error));
        reject(error);
      });
  });

  return gettingTeamCityData;
}

function findLastBuilds(runningBuilds, builds) {
  var allBuilds = [];

  if (runningBuilds.count > 0) {
    allBuilds = runningBuilds.build.concat(builds.build);
  } else {
    allBuilds = builds.build;
  }

  var buildTypeIds = _.uniq(allBuilds, function (v) { return v.buildTypeId; }).map(function (v) { return v.buildTypeId; });

  latestBuilds = [];
  _.each(buildTypeIds, function (buildTypeId) {
    var thisBuilds = _.filter(allBuilds, function (v) { return v.buildTypeId == buildTypeId; });
    var latestBuild = _.max(thisBuilds, function (v) { return v.id; });
    latestBuilds.push(latestBuild);
  });

  return latestBuilds;
}

function requestDetailedBuildData(datasource, builds) {
  return new Promise(function (resolve, reject){
    var detailedBuildRequests = _.map(builds, function (build) {
      var url = 'builds/id:' + build.id;
      return teamCityRequest(datasource, url);
    });

    Promise.all(detailedBuildRequests).then(function (detailedBuilds) {
      var res = JSON.stringify({
        result: 'success',
        builds: _.map(detailedBuilds, function (build) { return JSON.parse(build); })
      });
      resolve(res);
    });
  });
}

function refreshDatasource(datasource, io) {
  var eventId = datasource.plugin + '.' + datasource.id;

  var gettingRunningBuilds = teamCityRequest(datasource, 'builds?locator=running:true');
  var gettingBuilds = teamCityRequest(datasource, 'builds');

  Promise.all([gettingRunningBuilds, gettingBuilds]).then(function (results) {
    var runningBuilds = JSON.parse(results[0]);
    var builds = JSON.parse(results[1]);
    var lastBuilds = findLastBuilds(runningBuilds, builds);

    requestDetailedBuildData(datasource, lastBuilds)
      .then(function (data) {
        io.emit(eventId, data);
      })
      .catch(function (error) {
        console.log(error);
      });
  });
}

function initDatasource(datasource, io) {
  setInterval(function() {
    refreshDatasource(datasource, io);
  }, datasource.updateInterval);

}
exports.name = 'teamcity';
exports.initDatasource = initDatasource;
