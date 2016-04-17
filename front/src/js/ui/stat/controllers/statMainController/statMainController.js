import {enums} from './../../../../bl/module.js';

angular
    .module('rad.stat')
    .controller('statMainController', ['$rootScope', '$scope', '$state', 'bus', 'statPopupsFactory', 'appState',
        function ($rootScope, $scope, $state, bus, statPopupsFactory, appState) {
            $scope.currentTab = 'catalog';
            $rootScope.page.sectionTitle = 'Общая статистика сообществ';


            $('.icheck').iCheck({
                checkboxClass: 'icheckbox_flat-blue',
                radioClass: 'iradio_flat-blue'
            });
            $.plot($("#graphPeopleStat"), [{
                data: [
                    [1, 23],
                    [2, 56],
                    [3, 42],
                    [4, 8],
                    [5, 23],
                    [6, 88],
                    [7, 45],
                    [8, 43],
                    [9, 38],
                    [10, 39],
                    [11, 23],
                    [12, 44],
                    [13, 44],
                    [14, 44],
                    [15, 59],
                    [16, 60],
                    [17, 68],
                    [18, 32],
                    [19, 24],
                    [20, 45],
                    [21, 43],
                    [22, 87],
                    [23, 32],
                    [24, 51],
                    [25, 81],
                    [26, 30],
                    [27, 10],
                    [28, 60],
                    [29, 80],
                    [30, 60]
                ],
                label: "Unique Visits"
            },
                {
                    data: [
                        [1, 3],
                        [2, 1],
                        [3, 6],
                        [4, 2],
                        [5, 3],
                        [6, 1],
                        [7, 1],
                        [8, 6],
                        [9, 8],
                        [10, 6],
                        [11, 1],
                        [12, 2],
                        [13, 3],
                        [14, 5],
                        [15, 8],
                        [16, 3],
                        [17, 1],
                        [18, 6],
                        [19, 8],
                        [20, 6],
                        [21, 1],
                        [22, 2],
                        [23, 3],
                        [24, 5],
                        [25, 8],
                        [26, 3],
                        [27, 1],
                        [28, 6],
                        [29, 8],
                        [30, 6]
                    ],
                    label: "Unique Visits"
                }
            ], {
                series: {
                    bars: {
                        show: true,
                        barWidth: 0.4,
                        lineWidth: 0,
                        fill: true,
                        hoverable: true,
                        fillColor: {
                            colors: [{
                                opacity: 1
                            }, {
                                opacity: 0.9
                            }
                            ]
                        }
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
                colors: ["#2b9b29", "#823030", "#456a94"],
                xaxis: {
                    ticks: 11,
                    tickDecimals: 0
                },
                yaxis: {
                    ticks: 6,
                    tickDecimals: 0
                }
            });

            $.plot($("#graphPeopleAttendance"), [{
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
                legend:{
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
            });

            $.plot($("#graphPeopleStat2"), [{
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
                legend:{
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
            });


        }]);