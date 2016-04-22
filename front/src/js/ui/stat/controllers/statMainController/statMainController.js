import {enums} from './../../../../bl/module.js';

angular
    .module('rad.stat')
    .controller('statMainController', ['$rootScope', '$scope', '$state', 'bus', 'statPopupsFactory', 'appState', 'vkApiFactory',
        function ($rootScope, $scope, $state, bus, statPopupsFactory, appState, vkApiFactory) {
            $scope.currentTab = 'catalog';
            $rootScope.page.sectionTitle = 'Общая статистика сообществ';

            $scope.getStat = getStat;
            $scope.model = {
                groupAddress: ''
            };
            $scope.stat = {};

            var peopleStatGraph = (function () {
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

                    var config = peopleStatGraphConfig(data);
                    var ctx = document.getElementById("graphPeopleStat").getContext("2d");
                    ctx.clearRect(0, 0, document.getElementById("graphPeopleStat").width, document.getElementById("graphPeopleStat").height);
                    ctx.canvas.height = 300;
                    ctx.canvas.width = $("#graphPeopleStat").parent().width();

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
                var peopleStatGraphConfig = function (data) {
                    return {
                        type: 'line',
                        data: {
                            labels: data.labels,
                            datasets: [{
                                label: "Новых участников",
                                data: data.subscribedDataSet,
                                fill: false,
                                borderColor: '#597da3',
                                backgroundColor: '#597da3',
                                pointBorderWidth: 2,
                                pointHoverRadius: 3
                            }, {
                                label: "Вышедших участников",
                                data: data.unsubscribedDataSet,
                                fill: false,
                                borderColor: '#b05c91',
                                backgroundColor: '#b05c91'
                            }]
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

            var subscribersStatGraph = (function () {
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

                    var config = peopleStatGraphConfig(data);
                    var ctx = document.getElementById("subscribersStatGraph").getContext("2d");
                    ctx.clearRect(0, 0, document.getElementById("subscribersStatGraph").width, document.getElementById("subscribersStatGraph").height);
                    ctx.canvas.height = 300;
                    ctx.canvas.width = $("#subscribersStatGraph").parent().width();

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
                var peopleStatGraphConfig = function (data) {
                    return {
                        type: 'line',
                        data: {
                            labels: data.labels,
                            datasets: [{
                                label: "Количество участников",
                                data: data.membersCount,
                                fill: false,
                                borderColor: '#597da3',
                                backgroundColor: '#597da3',
                                pointBorderWidth: 2,
                                pointHoverRadius: 3
                            }]
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

            var attendanceStatGraph = (function () {
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

                    var config = peopleStatGraphConfig(data);
                    var ctx = document.getElementById("attendanceStatGraph").getContext("2d");
                    ctx.clearRect(0, 0, document.getElementById("attendanceStatGraph").width, document.getElementById("attendanceStatGraph").height);
                    ctx.canvas.height = 300;
                    ctx.canvas.width = $("#attendanceStatGraph").parent().width();

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
                var peopleStatGraphConfig = function (data) {
                    return {
                        type: 'line',
                        data: {
                            labels: data.labels,
                            datasets: [{
                                label: "Просмотров",
                                data: data.viewsData,
                                fill: false,
                                borderColor: '#597da3',
                                backgroundColor: '#597da3',
                                pointBorderWidth: 2,
                                pointHoverRadius: 3
                            }, {
                                label: "Посещений",
                                data: data.visitorsData,
                                fill: false,
                                borderColor: '#b05c91',
                                backgroundColor: '#b05c91'
                            }]
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

            $('.icheck').iCheck({
                checkboxClass: 'icheckbox_flat-blue',
                radioClass: 'iradio_flat-blue'
            });

            function getCheckedDate() {
                var checkDate = $('input[name=checkDate]:checked').val();
                var currDate = new Date();
                var dateTo = new Date();
                var dateFrom;

                switch (checkDate) {
                    case "week":
                        dateFrom = currDate.setDate(currDate.getDate() - 6);
                        break;
                    case "twoWeek":
                        dateFrom = currDate.setDate(currDate.getDate() - 13);
                        break;
                    case "month":
                        dateFrom = currDate.setDate(currDate.getDate() - 29);
                        break;
                }

                return {
                    from: moment(dateFrom).format("YYYY-MM-DD"),
                    to: moment(dateTo).format("YYYY-MM-DD")
                };
            }

            function getStat() {
                $scope.model.groupAddress = "https://vk.com/detsad02";
                if (!$scope.model.groupAddress) {
                    return;
                }

                var parseDate = getCheckedDate();

                var vkGroupId = $scope.model.groupAddress.replace("https://vk.com/", "");
                var vkGid;
                var authData = {
                    token: appState.getUserVkToken()
                };
                var groupInfo;

                vkApiFactory.getGroupInfo(authData, {
                    groupId: vkGroupId
                }).then(function (res) {
                    $scope.$apply(function () {
                        $scope.stat.membersCount = res.members_count;
                        vkGid = res.gid;
                    });
                    groupInfo = res;
                    getPeopleStat();
                });

                //Получение статистики по численности
                function getPeopleStat() {
                    vkApiFactory.getStat(authData, {
                        groupId: vkGid,
                        dateFrom: parseDate.from,
                        dateTo: parseDate.to
                    }).then(function (res) {
                        var stat = {
                            views: 0,
                            visitors: 0,
                            subscribed: 0,
                            unsubscribed: 0,
                            subscribedSumm: 0,
                            reach: 0,
                            reachSubscribers: 0
                        };
                        var graphPeopleStatData = {
                            labels: [],
                            subscribedDataSet: [],
                            unsubscribedDataSet: [],
                        };
                        var subscribersStatData = {
                            labels: [],
                            membersCount: []
                        };
                        var attendanceStatData = {
                            labels: [],
                            viewsData: [],
                            visitorsData: []
                        };
                        var currMembersCount = groupInfo.members_count;
                        res.forEach(function (dateStat, i) {
                            stat.views += dateStat.views ? dateStat.views : 0;
                            stat.visitors += dateStat.visitors ? dateStat.visitors : 0;
                            stat.subscribed += dateStat.subscribed ? dateStat.subscribed : 0;
                            stat.unsubscribed += dateStat.unsubscribed ? dateStat.unsubscribed : 0;
                            stat.reach += dateStat.reach ? dateStat.reach : 0;
                            stat.reachSubscribers += dateStat.reach_subscribers ? dateStat.reach_subscribers : 0;
                            //Сбор данных для графика участников
                            graphPeopleStatData.labels.unshift(getDateFromVk(dateStat.day));
                            graphPeopleStatData.subscribedDataSet.unshift(dateStat.subscribed);
                            graphPeopleStatData.unsubscribedDataSet.unshift(dateStat.unsubscribed);
                            //График посещаемости/просмотров группы
                            attendanceStatData.labels.unshift(getDateFromVk(dateStat.day));
                            attendanceStatData.viewsData.unshift(dateStat.views);
                            attendanceStatData.visitorsData.unshift(dateStat.visitors);

                            subscribersStatData.labels.unshift(getDateFromVk(dateStat.day));
                            if (i != 0)
                                currMembersCount -= (dateStat.subscribed - dateStat.unsubscribed);

                            subscribersStatData.membersCount.unshift(currMembersCount);
                        });

                        var summSubscribers = 0,
                            subscribersForStartPeriod;
                        graphPeopleStatData.subscribedDataSet.forEach(function (item) {
                            summSubscribers += item;
                        });
                        graphPeopleStatData.unsubscribedDataSet.forEach(function (item) {
                            summSubscribers -= item;
                        });

                        $scope.$apply(function () {
                            $scope.stat.views = stat.views;
                            $scope.stat.visitors = stat.visitors;
                            $scope.stat.subscribed = stat.subscribed;
                            $scope.stat.unsubscribed = stat.unsubscribed;
                            $scope.stat.subscribedSumm = stat.subscribed - stat.unsubscribed;
                            $scope.stat.reachSubscribers = stat.reachSubscribers;
                            $scope.stat.reach = stat.reach;
                        });

                        peopleStatGraph.showGraph(graphPeopleStatData);
                        subscribersStatGraph.showGraph(subscribersStatData);
                        attendanceStatGraph.showGraph(attendanceStatData);

                        function getDateFromVk(dateVk) {
                            var normilizedDate = new Date(dateVk);
                            return ('0' + normilizedDate.getDate()).slice(-2) + "." + ('0' + (normilizedDate.getMonth() + 1)).slice(-2);
                        }
                    });
                }
            }

        }]);