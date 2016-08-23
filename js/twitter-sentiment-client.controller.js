/**
 * Created by fzschornack on 09/08/2016.
 */
(function(){
    'use strict';

    angular
        .module('twitterSentimentClient')
        .controller('TwitterSentimentClientCtrl', TwitterSentimentClientCtrl);

    TwitterSentimentClientCtrl.$inject = ['$scope', '$timeout', '$http'];

    function TwitterSentimentClientCtrl($scope, $timeout, $http){

        var data = undefined;

        $scope.dailyPropertyName = 'total';
        $scope.dailyReverse = true;
        $scope.hourlyPropertyName = 'total';
        $scope.hourlyReverse = true;

        $scope.sortDailyTrendTopicsBy = sortDailyTrendTopicsBy;
        $scope.sortHourlyTrendTopicsBy = sortHourlyTrendTopicsBy;

        $scope.dailyTrendTopics = undefined;
        $scope.hourlyTrendTopics = undefined;
        $scope.tweetsWithSentiment = undefined;

        $scope.waitMessage = "";
        $scope.performSentimentAnalysis = performSentimentAnalysis;
        $scope.asTimestamp = asTimestamp;
        $scope.getSentimentCounts = getSentimentCounts;
        $scope.getMainSentiment = getMainSentiment;
        $scope.query = {
            startDate: undefined,
            endDate: undefined,
            text: "",
            operator: "or"
        };

        function performSentimentAnalysis() {

            $scope.waitMessage = 'Processing... Please, wait.';

            var queryData = angular.copy($scope.query);

            queryData.startDate = asTimestamp(queryData.startDate);
            queryData.endDate = asTimestamp(queryData.endDate);

            $http({
                method: 'POST',
                url: 'http://localhost:9001/sentiment',
                data: queryData,
                headers: {
                'Content-Type': 'application/json'
                }
            })
                .then(function successCallback(response) {
                    data = response.data;
                    $scope.dailyTrendTopics = response.data.dailyTrendTopics;
                    $scope.hourlyTrendTopics = response.data.hourlyTrendTopics;
                    $scope.tweetsWithSentiment = response.data.tweetsWithSentiment;
                    drawChart();
                    console.log(response.data.tweetsWithSentiment);
                    console.log(response.data.dailyTrendTopics);
                    console.log(response.data.hourlyTrendTopics);
                }, function errorCallback(error) {
                    console.log('error: ' + error.data);
                })
                .finally(function () {
                    $scope.waitMessage = "";
                });

        }
        
        function asTimestamp(date) {
            return Date.parse(date);
        }

        function getSentimentCounts(arrayOfSentimentCounts, sentiment) {
            var index = -1;
            for(var i = 0, l = arrayOfSentimentCounts.length; i<l; i++)
                if(arrayOfSentimentCounts[i].sentiment === sentiment) {
                    index = i;
                    break;
                }

            return index == -1 ? 0 : arrayOfSentimentCounts[index].count;
        }

        function getMainSentiment(arrayOfSentimentCounts) {
            var index = -1;
            var max = -1;
            for(var i = 0, l = arrayOfSentimentCounts.length; i<l; i++)
                if(arrayOfSentimentCounts[i].count > max) {
                    index = i;
                    max = arrayOfSentimentCounts[i].count;
                }

            return index == -1 ? 'NEUTRAL' : arrayOfSentimentCounts[index].sentiment;
        }

        function sortDailyTrendTopicsBy(propertyName) {
            $scope.dailyReverse = ($scope.dailyPropertyName === propertyName) ? !$scope.dailyReverse : false;
            $scope.dailyPropertyName = propertyName;
        }

        function sortHourlyTrendTopicsBy(propertyName) {
            $scope.hourlyReverse = ($scope.hourlyPropertyName === propertyName) ? !$scope.hourlyReverse : false;
            $scope.hourlyPropertyName = propertyName;
        }

        function drawChart() {
            var tweetsChart = dc.barChart("#tweets-chart");

            var dateTimeFormat = d3.time.format("%Y-%m-%dT%H:%M:%S");
            var titleDateTimeFormat = d3.time.format("%a, %b %e, %Y %I %p");

            data.tweetsWithSentiment.forEach(function (d, idx) {
                //add dateTimeParsed field
                d.dateTime = d.dateTime.substr(0, 19);
                d.dateTimeParsed = dateTimeFormat.parse(d.dateTime);
            });

            // Run the data through crossfilter and load our 'facts'
            var facts = crossfilter(data.tweetsWithSentiment);

            // Create a dimension just for the hour from the dateTimeParsed field
            var hourDimension = facts.dimension(function (d) {
                d.hour = d3.time.hour(d.dateTimeParsed);
                return d.hour;
            });

            var hourPositiveGroup = hourDimension.group().reduceSum(function (d) {
                return d.sentiment == "POSITIVE" ? 1 : 0;
            });

            var hourNegativeGroup = hourDimension.group().reduceSum(function (d) {
                return d.sentiment == "NEGATIVE" ? 1 : 0;
            });

            var hourNeutralGroup = hourDimension.group().reduceSum(function (d) {
                return d.sentiment == "NEUTRAL" ? 1 : 0;
            });

            tweetsChart
                .width(900)
                .height(200)
                .margins({top: 10, right: 50, bottom: 40, left: 40})
                .ordinalColors(['#fc8d62','#8da0cb','#66c2a5'])
                .dimension(hourDimension)
                .group(hourNegativeGroup, "Negative")
                .x(d3.time.scale().domain([d3.time.hour.offset(d3.min(data.tweetsWithSentiment, function(d) {
                    return d.dateTimeParsed;
                }),-1), d3.time.hour.offset(d3.max(data.tweetsWithSentiment, function(d) {
                    return d.dateTimeParsed;
                }),+1)]))
                .stack(hourNeutralGroup, "Neutral")
                .stack(hourPositiveGroup, "Positive")
                .brushOn(false)
                .centerBar(true)
                .xUnits(function(){return 120;})
                .gap(1)
                .legend(dc.legend().x(70).y(10).itemHeight(13).gap(5))
                .renderHorizontalGridLines(true)
                .yAxisLabel("Number of Tweets")
                .xAxisLabel("Time")
                .title(function(d) {
                    return titleDateTimeFormat(d.key) + ': ' + d.value;
                });

            dc.renderAll();
        }
        
    }
    
})();