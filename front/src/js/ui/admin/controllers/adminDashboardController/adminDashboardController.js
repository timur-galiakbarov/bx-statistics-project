import events from './../../../../bl/events.js';
import topics from './../../../../bl/topics.js';
import {enums} from './../../../../bl/module.js';

angular
    .module('rad.stat')
    .controller('adminDashboardController', ['$rootScope', '$scope', '$state', 'bus', 'vkApiFactory', 'appState', '$timeout',
        function ($rootScope, $scope, $state, bus, vkApiFactory, appState, $timeout) {

            $scope.stat = {
                userAllToday: 0,
                userNewToday: 0,
                userOldToday: 0
            };
            $scope.getColorStatus = getColorStatus;
            $scope.refresh = refresh;

            bus.publish(events.ADMIN.STATE_CHANGED, "dashboard");

            var authData = {
                token: appState.getUserVkToken(),
                login: appState.getUserVkLogin()
            };

            var graph = (function () {
                var startRender = false,
                    currgraph,
                    chart;
                var showGraph = function (data) {
                    currgraph = data;
                    renderGraph(data);
                    initHandlers();
                };
                var renderGraph = function (data) {
                    if (chart)
                        chart.destroy();

                    var config = graphConfig(data);
                    var ctx = document.getElementById(currgraph.element) ? document.getElementById(currgraph.element).getContext("2d") : false;
                    if (!ctx) {

                        return;
                    }
                    ctx.clearRect(0, 0, document.getElementById(currgraph.element).width, document.getElementById(currgraph.element).height);
                    ctx.canvas.height = 300;
                    ctx.canvas.width = $("#" + currgraph.element).parent().width();

                    chart = new Chart(ctx, config);

                    startRender = false;
                };
                var initHandlers = function () {
                    $(window).resize(function () {
                        if (startRender)
                            return;

                        startRender = true;
                        setTimeout(function () {
                            renderGraph(currgraph);
                        }, 200);
                    });
                };
                var graphConfig = function (data) {
                    return {
                        type: 'bar',
                        data: {
                            labels: currgraph.labels,
                            datasets: currgraph.datasets
                        },
                        options: {
                            responsive: false,
                            title: {
                                display: true,
                                text: ''
                            },
                            tooltips: {
                                mode: 'label',
                            },
                            hover: {
                                mode: 'dataset'
                            },
                            scales: {
                                xAxes: [{
                                    display: true,
                                    scaleLabel: {
                                        show: true,
                                        labelString: 'Дата'
                                    }
                                }],
                                yAxes: [{
                                    display: true,
                                    scaleLabel: {
                                        show: true,
                                        labelString: 'Значение'
                                    }
                                }]
                            },
                            legend: {
                                display: false,
                                labelspadding: 0
                            }
                        }
                    }
                };

                return {
                    showGraph: showGraph
                }
            })();

            function getAdminStat() {
                return bus.request(topics.ADMIN.GET_STAT)
                    .then((res)=> {
                        $timeout(()=> {
                            $scope.stat.userAllToday = res.data.usersAllToday || 0;
                            $scope.stat.userNewToday = res.data.usersNewToday || 0;
                            $scope.stat.userOldToday = res.data.usersOldToday || 0;
                            $scope.stat.usersAll = res.data.usersAll;
                            $scope.stat.usersList = res.data.usersList;
                            $scope.stat.payCount = res.data.payCount;
                            $scope.stat.payCountCurrentMonth = res.data.payCountCurrentMonth;
                            $scope.stat.payCountLastMonth = res.data.payCountLastMonth;
                            $scope.stat.payCountRur = res.data.payCountRur;

                            $scope.stat.registerGraph = formatGraphData(res.data.usersRegisterList);
                            graph.showGraph({
                                element: "registerGraph",
                                labels: $scope.stat.registerGraph.map((item)=> {
                                    return item.label;
                                }),
                                datasets: [{
                                    label: "Новых пользователей",
                                    data: $scope.stat.registerGraph.map((item)=> {
                                        return item.counter;
                                    }),
                                    fill: false,
                                    borderColor: '#597da3',
                                    backgroundColor: '#597da3',
                                    pointBorderWidth: 2,
                                    pointHoverRadius: 3
                                }]
                            });

                            $scope.isLoading = false;
                        });
                    });
            }

            function formatGraphData(list) {
                var graphData = [];

                var lastDate = '';
                var currCounter = 0;
                list.forEach((user)=> {
                    if (!lastDate) {
                        lastDate = user.dateRegister;
                        currCounter++;
                    } else {
                        if (user.dateRegister == lastDate) {
                            currCounter++;
                        } else {
                            var labelDate = new Date(lastDate);
                            graphData.push({
                                label: labelDate.getDate() + "." + (labelDate.getMonth() + 1) + "." + labelDate.getFullYear(),
                                counter: currCounter
                            });

                            lastDate = user.dateRegister;
                            currCounter = 1;
                        }
                    }
                });

                var labelDate = new Date(lastDate);
                graphData.push({
                    label: labelDate.getDate() + "." + (labelDate.getMonth() + 1) + "." + labelDate.getFullYear(),
                    counter: currCounter
                });

                graphData = graphData.reverse();

                return graphData;
            }

            function getColorStatus(activeDate) {
                if (!activeDate)
                    return "grey";

                var parseDate = activeDate.split(".");
                var activeDateNormilize = new Date(parseDate[2], parseDate[1] - 1, parseDate[0]).getTime();
                var currentDate = (new Date()).getTime();


                if (activeDateNormilize - currentDate > 0 && activeDateNormilize - currentDate < 2 * 24 * 60 * 60 * 1000) {
                    return "orange";
                }

                if (activeDateNormilize - currentDate > 6 * 24 * 60 * 60 * 1000) {
                    return "blue";
                }

                if (activeDateNormilize - currentDate < 0) {
                    return "red";
                }

                return "grey";
            }

            function init() {

                $rootScope.setTitle("Admin Dashboard");
                $scope.isLoading = true;
                getAdminStat();
            }

            function refresh() {
                $scope.isLoading = true;
                getAdminStat();
            }

            init();

        }]);