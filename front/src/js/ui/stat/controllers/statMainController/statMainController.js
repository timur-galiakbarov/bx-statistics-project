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

                vkApiFactory.getGroupInfo(authData, {
                    groupId: vkGroupId
                }).then(function (res) {
                    $scope.$apply(function () {
                        $scope.stat.membersCount = res.members_count;
                        vkGid = res.gid;
                    });
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
                        res.forEach(function (dateStat) {
                            stat.views += dateStat.views ? dateStat.views : 0;
                            stat.visitors += dateStat.visitors ? dateStat.visitors : 0;
                            stat.subscribed += dateStat.subscribed ? dateStat.subscribed : 0;
                            stat.unsubscribed += dateStat.unsubscribed ? dateStat.unsubscribed : 0;
                            stat.reach += dateStat.reach ? dateStat.reach : 0;
                            stat.reachSubscribers += dateStat.reach_subscribers ? dateStat.reach_subscribers : 0;
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
                    });
                }

                var startRender = false;
                function renderGraph() {
                    console.log("render!");
                    var config = {
                        type: 'line',
                        data: {
                            labels: ["January", "February", "March", "April", "May", "June", "July", "2", "2", "2", "2", "2"],
                            datasets: [{
                                label: "Новых участников",
                                data: [2, 1, 5, 3, 5, 5, 2, 7, 6, 5, 8, 2],
                                fill: false,
                                borderColor: '#597da3',
                                backgroundColor: '#597da3'
                            }, {
                                label: "Вышедших участников",
                                data: [1, 0, 0, 3, 2, 0, 1, 2, 1, 0, 2, 1],
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
                            }
                        }
                    };
                    var ctx = document.getElementById("graphPeopleStat").getContext("2d");
                    ctx.canvas.height = 300;
                    ctx.canvas.width = $("#graphPeopleStat").parent().width();
                    new Chart(ctx, config);

                    startRender = false;
                }

                $(window).resize(function () {
                    if (startRender)
                        return;

                    startRender = true;
                    setTimeout(renderGraph, 200);
                });

                renderGraph();
            }

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

            $('.icheck').iCheck({
                checkboxClass: 'icheckbox_flat-blue',
                radioClass: 'iradio_flat-blue'
            });

            /* $.plot($("#graphPeopleAttendance"), [{
             data: [
             [1, 100],
             [2, 105],
             [3, 109],
             [4, 150],
             [5, 250],
             [6, 220],
             [7, 200],
             [8, 188],
             [9, 230],
             [10, 130],
             [11, 140],
             [12, 105],
             [13, 190],
             [14, 200],
             [15, 220],
             [16, 210],
             [17, 205],
             [18, 187],
             [19, 210],
             [20, 140],
             [21, 145],
             [22, 189],
             [23, 190]
             ],
             label: "Sales"
             }
             ], {
             series: {
             lines: {
             show: true,
             lineWidth: 2,
             fill: true,
             fillColor: {
             colors: [{
             opacity: 0.25
             }, {
             opacity: 0.25
             }
             ]
             }
             },
             points: {
             show: true
             },
             shadowSize: 2
             },
             legend: {
             show: false
             },
             grid: {
             labelMargin: 10,
             axisMargin: 500,
             hoverable: true,
             clickable: true,
             tickColor: "rgba(0,0,0,0.15)",
             borderWidth: 0
             },
             colors: ["#3d566d", "#4A8CF7", "#52e136"],
             xaxis: {
             ticks: 11,
             tickDecimals: 0
             },
             yaxis: {
             ticks: 5,
             tickDecimals: 0
             }
             });*/

            /*$.plot($("#graphPeopleStat2"), [{
             data: [
             [1, 100],
             [2, 105],
             [3, 109],
             [4, 150],
             [5, 250],
             [6, 220],
             [7, 200],
             [8, 188],
             [9, 230],
             [10, 130],
             [11, 140],
             [12, 105],
             [13, 190],
             [14, 200],
             [15, 220],
             [16, 210],
             [17, 205],
             [18, 187],
             [19, 210],
             [20, 140],
             [21, 145],
             [22, 189],
             [23, 190]
             ],
             label: "Sales"
             }
             ], {
             series: {
             lines: {
             show: true,
             lineWidth: 2,
             fill: true,
             fillColor: {
             colors: [{
             opacity: 0.25
             }, {
             opacity: 0.25
             }
             ]
             }
             },
             points: {
             show: true
             },
             shadowSize: 2
             },
             legend: {
             show: false
             },
             grid: {
             labelMargin: 10,
             axisMargin: 500,
             hoverable: true,
             clickable: true,
             tickColor: "rgba(0,0,0,0.15)",
             borderWidth: 0
             },
             colors: ["#3d566d", "#4A8CF7", "#52e136"],
             xaxis: {
             ticks: 11,
             tickDecimals: 0
             },
             yaxis: {
             ticks: 5,
             tickDecimals: 0
             }
             });*/


        }]);