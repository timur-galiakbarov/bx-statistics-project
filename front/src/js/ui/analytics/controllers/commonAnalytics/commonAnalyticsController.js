import events from './../../../../bl/events.js';
import topics from './../../../../bl/topics.js';
import {enums} from './../../../../bl/module.js';

angular
    .module('rad.stat')
    .controller('commonAnalyticsController', ['$rootScope', '$scope', '$state', 'bus', 'statPopupsFactory', 'appState', 'vkApiFactory', 'memoryFactory', '$timeout', 'radCommonFunc', '$stateParams', 'notify', 'permissionService',
        function ($rootScope, $scope, $state, bus, statPopupsFactory, appState, vkApiFactory, memoryFactory, $timeout, radCommonFunc, $stateParams, notify, permissionService) {

            $scope.model = {
                groupAddress: '',
                datePicker: {
                    dateFrom: '',
                    dateTo: '',
                    popupFrom: {
                        opened: false
                    },
                    popupTo: {
                        opened: false
                    }
                },
                wall: getNulledWall(),
                postsFilter: "likes",
                groupInfo: {
                    screen_name: ""
                },
                stat: {}
            };

            $scope.error = {};
            $scope.statIsLoaded = false;
            $scope.isHiddenMenu = true;
            $scope.statNotAccess = false;
            $scope.groupIsFinded = false;
            $scope.progressPercent = 0.0;
            $scope.progressPercentSubscribers = 0.0;
            $scope.percentItem = (100 / 6).toFixed(2);
            $scope.adminGroups = [];
            $scope.activeTab = 'report';
            $scope.hiddenFilter = false;

            $scope.getStatWithCheck = getStatWithCheck;
            $scope.showGroupsMenu = showGroupsMenu;
            $scope.nextProgressStep = nextProgressStep;
            $scope.showTab = showTab;
            $scope.openDatepickerPopupFrom = openDatepickerPopupFrom;
            $scope.openDatepickerPopupTo = openDatepickerPopupTo;
            $scope.getDate = getDate;
            $scope.sortPostsList = sortPostsList;
            $scope.nextPosts = nextPosts;
            $scope.getAuditory = getAuditory;

            $scope.$watch('isLoading', (newVal)=> {
                $rootScope.globalLoading = newVal;
            });

            $scope.$watch('model.postsFilter', (newVal, oldVal)=> {
                if (newVal != oldVal)
                    sortPostsList(newVal);
            });

            $scope.$watch('model.datePicker.dateFrom', (newVal, oldVal)=> {
                if (newVal != oldVal) {
                    $scope.error.datePickerFromError = "";
                    var radios = $('input[name=checkDate]');
                    radios.filter('[value=datePicker]').prop("checked", true);
                }
            });

            $scope.$watch('model.datePicker.dateTo', (newVal, oldVal)=> {
                if (newVal != oldVal) {
                    $scope.error.datePickerToError = "";
                    var radios = $('input[name=checkDate]');
                    radios.filter('[value=datePicker]').prop("checked", true);
                }
            });

            var authData = {
                token: appState.getUserVkToken(),
                login: appState.getUserVkLogin()
            };

            var graphModel = {};

            var needGetStatFromParams = $stateParams.gid ? $stateParams.gid : false;

            function defaultGraph(conf) {
                var startRender = false,
                    currgraph,
                    chart;
                var externalConfig = conf;
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
                    bus.subscribe(events.STAT.MAIN.RESIZE_GRAPH, ()=> {
                        setTimeout(function () {
                            renderGraph(currgraph);
                        }, 0);
                    });
                };
                var graphConfig = function (data) {
                    return {
                        type: externalConfig && externalConfig.type ? externalConfig.type : 'line',
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

                this.showGraph = showGraph;
                this.destroy = ()=> {
                    if (chart) {
                        chart.destroy();
                    }
                };
                this.getChart = ()=> {
                    return chart;
                }
            }

            function getCheckedDate() {
                var checkDate = $('input[name=checkDate]:checked').val();
                var currDate = new Date;
                currDate.setHours(0, 0, 0, 0);
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
                    case "datePicker":
                        if (!$scope.model.datePicker.dateFrom) {
                            $scope.error.datePickerFromError = "Неверная дата";
                            return {
                                error: true
                            }
                        }
                        if (!$scope.model.datePicker.dateTo) {
                            $scope.error.datePickerToError = "Неверная дата";
                            return {
                                error: true
                            }
                        }
                        if ($scope.model.datePicker.dateFrom > $scope.model.datePicker.dateTo) {
                            $scope.error.datePickerFromError = "Дата начала превышает дату окончания";
                            return {
                                error: true
                            }
                        }
                        if ($scope.model.datePicker.dateFrom.getTime() == $scope.model.datePicker.dateTo.getTime()) {
                            $scope.model.datePicker.dateTo = new Date($scope.model.datePicker.dateTo.getTime() + 24 * 60 * 60 * 1000);
                        }

                        dateFrom = $scope.model.datePicker.dateFrom;
                        dateTo = $scope.model.datePicker.dateTo;

                        break;
                }

                return {
                    from: moment(dateFrom).format("YYYY-MM-DD"),
                    fromLabel: moment(dateFrom).format("DD.MM.YYYY"),
                    to: moment(dateTo).format("YYYY-MM-DD"),
                    toLabel: moment(dateTo).format("DD.MM.YYYY"),
                    unixFrom: dateFrom / 1000,
                    unixTo: dateTo / 1000
                };
            }

            function getStatWithCheck() {
                $scope.isLoading = true;
                var vkGroupId = radCommonFunc.getGroupId($scope.model.groupAddress);

                permissionService.canUseAnalytics({
                    gid: vkGroupId
                }).then((res)=> {
                    if (res.success) {
                        getStat();
                    } else {
                        $scope.isLoading = false;
                        $state.go('index.analytics');
                        if (res.error == "notSubscribeVk") {
                            bus.publish(events.ACCOUNT.SHOW_NOT_SUBSCRIBE_MODAL);
                            return;
                        }
                        bus.publish(events.ACCOUNT.SHOW_PERIOD_FINISHED_MODAL);
                    }
                });
            }

            function getStat() {
                var vkGroupId = radCommonFunc.getGroupId($scope.model.groupAddress);

                $scope.groupIsFinded = false;
                $scope.progressPercent = 0.0;
                $scope.activeTab = 'report';
                $scope.isLoading = true;

                var vkGid;
                var groupInfo;
                var ER = 0;
                var parseDate = getCheckedDate();
                if (!parseDate || (parseDate && parseDate.error)) {
                    notify.error("Неверно указана дата для анализа. Пожалуйста, измените значения и повторите операцию");
                    return;
                }

                $scope.model.groupInfo.groupAddress = $scope.model.groupAddress;
                $scope.model.groupInfo.periodValue = $('input[name=checkDate]:checked').val();
                $scope.model.groupInfo.periodLabels = {
                    from: parseDate.fromLabel,
                    to: parseDate.toLabel
                };

                $scope.hiddenFilter = true;

                bus.request(topics.VK.GET_GROUP_INFO, authData, {
                    groupId: vkGroupId,
                    fields: "photo_big,photo_medium,photo,members_count,counters,description"
                }).then(function (res) {

                    if (res && res.error && res.error.error_code == 100) {
                        $scope.$apply(function () {
                            $scope.urlError = 'Введеная группа вконтакте не найдена';
                            $scope.isLoading = false;
                            $scope.statIsLoaded = false;
                            $scope.hiddenFilter = false;
                        });
                        return;
                    }

                    if (res && res.error && res.error.error_code == 6) {
                        setTimeout(()=> {
                            //console.log("recursive!");
                            getStat();
                        }, 1500);
                        return;
                    }

                    $scope.$apply(function () {
                        $scope.statIsLoaded = true;
                        $scope.groupIsFinded = true;
                        $scope.model.groupInfo.membersCount = res.members_count;
                        $scope.model.groupInfo.groupName = res.name;
                        $scope.model.groupInfo.gid = res.gid;
                        $scope.model.groupInfo.groupImage = res.photo_big || res.photo_medium || res.photo;
                        $scope.model.groupInfo.description = res.description;
                        $scope.model.groupInfo.screen_name = res.screen_name;
                        vkGid = res.gid;
                    });
                    groupInfo = res;

                    var filter = {
                        group: groupInfo,
                        authData: authData,
                        period: parseDate
                    };

                    console.log(filter);

                    $.when(
                        getPeopleStat().always(()=> {
                            $scope.nextProgressStep($scope.percentItem);
                        }),
                        bus.request(topics.STAT.GET_WALL, filter).then((data)=> {
                            console.log(data);
                            var wall = calculateWallStat(data);
                            $scope.model.wall = wall;
                            sortPostsList();

                            $timeout(()=> {
                                $scope.nextProgressStep($scope.percentItem);
                            });
                        }),
                        bus.request(topics.STAT.GET_PHOTO, filter).then((data)=> {
                            var photo = calculatePhotoStat(data);
                            $scope.model.photo = photo;
                            $timeout(()=> {
                                $scope.nextProgressStep($scope.percentItem);
                            });
                        }),
                        bus.request(topics.STAT.GET_PHOTO_COMMENTS, filter).then((data)=> {
                            var photoComments = calculatePhotoCommentsStat(data);
                            $scope.model.photoComments = photoComments;
                            $timeout(()=> {
                                $scope.nextProgressStep($scope.percentItem);
                            });
                        }),
                        bus.request(topics.STAT.GET_VIDEO, filter).then((data)=> {
                            var video = calculateVideoStat(data);
                            $scope.model.video = video;
                            $timeout(()=> {
                                $scope.nextProgressStep($scope.percentItem);
                            });
                        })
                    )
                        .then(()=> {
                            //Рисуем графики
                            renderAllGraphs();
                            $scope.progressPercent = 100;
                            $timeout(()=> {
                                $scope.isLoading = false;
                            });
                        })
                        .error(()=> {
                            $scope.progressPercent = 100;
                            $timeout(()=> {
                                $scope.isLoading = false;
                            });
                        });
                });

                //Получение статистики по численности
                function getPeopleStat() {
                    var deferr = $.Deferred();

                    getPeopleStatRequest();

                    function getPeopleStatRequest() {
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
                                subscribedPercent: 0,
                                reach: 0,
                                reachSubscribers: 0
                            };
                            var graphPeopleStatData = {
                                labels: [],
                                subscribedDataSet: [],
                                unsubscribedDataSet: []
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
                            if (res && !res.error) {
                                $scope.statNotAccess = false;
                                res.forEach(function (dateStat, i) {
                                    stat.views += dateStat.views ? dateStat.views : 0;
                                    stat.visitors += dateStat.visitors ? dateStat.visitors : 0;
                                    stat.subscribed += dateStat.subscribed ? dateStat.subscribed : 0;
                                    stat.unsubscribed += dateStat.unsubscribed ? dateStat.unsubscribed : 0;
                                    stat.reach += dateStat.reach ? dateStat.reach : 0;
                                    stat.reachSubscribers += dateStat.reach_subscribers ? dateStat.reach_subscribers : 0;
                                    //Сбор данных для графика участников
                                    graphPeopleStatData.labels.unshift(getDateFromVk(dateStat.day));
                                    graphPeopleStatData.subscribedDataSet.unshift(dateStat.subscribed || 0);
                                    graphPeopleStatData.unsubscribedDataSet.unshift(dateStat.unsubscribed || 0);
                                    //График посещаемости/просмотров группы
                                    attendanceStatData.labels.unshift(getDateFromVk(dateStat.day));
                                    attendanceStatData.viewsData.unshift(dateStat.views || 0);
                                    attendanceStatData.visitorsData.unshift(dateStat.visitors || 0);

                                    subscribersStatData.labels.unshift(getDateFromVk(dateStat.day));
                                    if (i != 0)
                                        currMembersCount -= (dateStat.subscribed - dateStat.unsubscribed);

                                    subscribersStatData.membersCount.unshift(currMembersCount);
                                });
                            }


                            if (res && res.error) {
                                switch (res.error.error_code) {
                                    case 7:
                                        //Статистика группы недоступна
                                        $scope.statNotAccess = true;
                                        break;
                                    case 6:
                                    {
                                        setTimeout(()=> {
                                            getPeopleStatRequest();
                                        }, 500);
                                        return deferr.promise();
                                    }
                                }

                            }

                            var summSubscribers = 0,
                                subscribersForStartPeriod;
                            graphPeopleStatData.subscribedDataSet.forEach(function (item) {
                                summSubscribers += item;
                            });
                            graphPeopleStatData.unsubscribedDataSet.forEach(function (item) {
                                summSubscribers -= item;
                            });

                            $scope.$apply(function () {
                                $scope.model.stat.views = stat.views;
                                $scope.model.stat.visitors = stat.visitors;
                                $scope.model.stat.subscribed = stat.subscribed;
                                $scope.model.stat.unsubscribed = stat.unsubscribed;
                                $scope.model.stat.subscribedSumm = stat.subscribed - stat.unsubscribed;
                                $scope.model.stat.subscribedPercent = ($scope.model.groupInfo.membersCount ? ($scope.model.stat.subscribedSumm / $scope.model.groupInfo.membersCount) * 100 : 0).toFixed(2);
                                $scope.model.stat.reachSubscribers = stat.reachSubscribers;
                                $scope.model.stat.reach = stat.reach;
                                $scope.model.stat.graph = {
                                    graphPeopleStatData: graphPeopleStatData,
                                    subscribersStatData: subscribersStatData,
                                    attendanceStatData: attendanceStatData
                                };
                            });

                            deferr.resolve();

                            function getDateFromVk(dateVk) {
                                var normilizedDate = new Date(dateVk);
                                return ('0' + normilizedDate.getDate()).slice(-2) + "." + ('0' + (normilizedDate.getMonth() + 1)).slice(-2);
                            }
                        }).fail(function () {
                            deferr.reject();
                        });
                    }

                    return deferr.promise();
                }
            }

            function showGroupsMenu() {
                $scope.isHiddenMenu = !$scope.isHiddenMenu;
            }

            function nextProgressStep(step) {
                if (step == 0 || !step) {
                    return;
                }

                var progressPercent = parseFloat($scope.progressPercent);
                progressPercent += parseFloat(step);
                progressPercent = progressPercent.toFixed(2);

                if (progressPercent < 100) {
                    $timeout(()=> {
                        $scope.progressPercent = progressPercent;
                    });
                }
            }

            function init() {
                if (!needGetStatFromParams){
                    $state.go('index.analytics');
                    return;
                }

                $rootScope.setTitle("Подробная статистика сообщества");
                //createCharts
                graphModel.wallActivityGraph = new defaultGraph();
                graphModel.wallActivityGraphReport = new defaultGraph();
                graphModel.wallLikesGraph = new defaultGraph();
                graphModel.wallRepostsGraph = new defaultGraph();
                graphModel.wallCommentsGraph = new defaultGraph();
                graphModel.subscribersStatGraph = new defaultGraph();
                graphModel.subscribersStatGraphReport = new defaultGraph();
                graphModel.peopleStatGraph = new defaultGraph();
                graphModel.attendanceStatGraph = new defaultGraph();
                graphModel.wallERGraph = new defaultGraph();
                graphModel.averageDayGraphReport = new defaultGraph({
                    type: "bar"
                });
                graphModel.postDayGraphReport = new defaultGraph({
                    type: "bar"
                });
                graphModel.postDayGraph = new defaultGraph({
                    type: "bar"
                });

                if (needGetStatFromParams) {
                    $scope.model.groupAddress = needGetStatFromParams;
                    getStatWithCheck();
                }
            }

            function showTab(tab) {
                $scope.activeTab = tab;
                bus.publish(events.STAT.MAIN.RESIZE_GRAPH);
            }

            function renderAllGraphs() {
                //График динамики реакций на контент
                if (graphModel.wallActivityGraph) {
                    graphModel.wallActivityGraph.destroy();
                }

                graphModel.wallActivityGraph.showGraph({
                    element: "wallActivityGraph",
                    labels: $scope.model.wall.dayGroups.map((item)=> {
                        return item.date;
                    }),
                    datasets: [{
                        label: "Реакции на контент",
                        data: $scope.model.wall.dayGroups.map((item)=> {
                            return item.summActions;
                        }),
                        fill: false,
                        borderColor: '#597da3',
                        backgroundColor: '#597da3',
                        pointBorderWidth: 2,
                        pointHoverRadius: 3
                    }, {
                        label: "Средняя реакция в день за период",
                        data: $scope.model.wall.dayGroups.map((item)=> {
                            return $scope.model.wall.srDayActivity;
                        }),
                        fill: false,
                        borderColor: '#208e68',
                        backgroundColor: '#208e68',
                        pointBorderWidth: 0,
                        pointHoverRadius: 3
                    }]
                });
                if (graphModel.wallActivityGraphReport) {
                    graphModel.wallActivityGraphReport.destroy();
                }

                graphModel.wallActivityGraphReport.showGraph({
                    element: "wallActivityGraphReport",
                    labels: $scope.model.wall.dayGroups.map((item)=> {
                        return item.date;
                    }),
                    datasets: [{
                        label: "Реакции на контент",
                        data: $scope.model.wall.dayGroups.map((item)=> {
                            return item.summActions;
                        }),
                        fill: false,
                        borderColor: '#597da3',
                        backgroundColor: '#597da3',
                        pointBorderWidth: 2,
                        pointHoverRadius: 3
                    }, {
                        label: "Средняя реакция в день за период",
                        data: $scope.model.wall.dayGroups.map((item)=> {
                            return $scope.model.wall.srDayActivity;
                        }),
                        fill: false,
                        borderColor: '#208e68',
                        backgroundColor: '#208e68',
                        pointBorderWidth: 0,
                        pointHoverRadius: 3
                    }]
                });
                //График лайков на стене
                if (graphModel.wallLikesGraph) {
                    graphModel.wallLikesGraph.destroy();
                }

                graphModel.wallLikesGraph.showGraph({
                    element: "wallLikesGraph",
                    labels: $scope.model.wall.dayGroups.map((item)=> {
                        return item.date;
                    }),
                    datasets: [{
                        label: "Лайки на стене",
                        data: $scope.model.wall.dayGroups.map((item)=> {
                            return item.likes;
                        }),
                        fill: false,
                        borderColor: '#597da3',
                        backgroundColor: '#597da3',
                        pointBorderWidth: 2,
                        pointHoverRadius: 3
                    }]
                });

                //График репостов со стены
                if (graphModel.wallRepostsGraph) {
                    graphModel.wallRepostsGraph.destroy();
                }

                graphModel.wallRepostsGraph.showGraph({
                    element: "wallRepostsGraph",
                    labels: $scope.model.wall.dayGroups.map((item)=> {
                        return item.date;
                    }),
                    datasets: [{
                        label: "Репосты со стены",
                        data: $scope.model.wall.dayGroups.map((item)=> {
                            return item.reposts;
                        }),
                        fill: false,
                        borderColor: '#597da3',
                        backgroundColor: '#597da3',
                        pointBorderWidth: 2,
                        pointHoverRadius: 3
                    }]
                });
                //График комментариев на стене
                if (graphModel.wallCommentsGraph) {
                    graphModel.wallCommentsGraph.destroy();
                }

                graphModel.wallCommentsGraph.showGraph({
                    element: "wallCommentsGraph",
                    labels: $scope.model.wall.dayGroups.map((item)=> {
                        return item.date;
                    }),
                    datasets: [{
                        label: "Комментарии на стене",
                        data: $scope.model.wall.dayGroups.map((item)=> {
                            return item.comments;
                        }),
                        fill: false,
                        borderColor: '#597da3',
                        backgroundColor: '#597da3',
                        pointBorderWidth: 2,
                        pointHoverRadius: 3
                    }]
                });
                //График динамики количества участников
                if (graphModel.subscribersStatGraph) {
                    graphModel.subscribersStatGraph.destroy();
                }

                graphModel.subscribersStatGraph.showGraph({
                    element: "subscribersStatGraph",
                    labels: $scope.model.stat.graph.subscribersStatData.labels,
                    datasets: [{
                        label: "Количество пользователей",
                        data: $scope.model.stat.graph.subscribersStatData.membersCount,
                        fill: false,
                        borderColor: '#597da3',
                        backgroundColor: '#597da3',
                        pointBorderWidth: 2,
                        pointHoverRadius: 3
                    }]
                });

                if (graphModel.subscribersStatGraphReport) {
                    graphModel.subscribersStatGraphReport.destroy();
                }

                graphModel.subscribersStatGraphReport.showGraph({
                    element: "subscribersStatGraphReport",
                    labels: $scope.model.stat.graph.subscribersStatData.labels,
                    datasets: [{
                        label: "Количество пользователей",
                        data: $scope.model.stat.graph.subscribersStatData.membersCount,
                        fill: false,
                        borderColor: '#597da3',
                        backgroundColor: '#597da3',
                        pointBorderWidth: 2,
                        pointHoverRadius: 3
                    }]
                });
                //График количества вступивших и вышедших участников
                if (graphModel.peopleStatGraph) {
                    graphModel.peopleStatGraph.destroy();
                }

                graphModel.peopleStatGraph.showGraph({
                    element: "graphPeopleStat",
                    labels: $scope.model.stat.graph.graphPeopleStatData.labels,
                    datasets: [{
                        label: "Новых участников",
                        data: $scope.model.stat.graph.graphPeopleStatData.subscribedDataSet,
                        fill: false,
                        borderColor: '#597da3',
                        backgroundColor: '#597da3',
                        pointBorderWidth: 2,
                        pointHoverRadius: 3
                    }, {
                        label: "Вышедших участников",
                        data: $scope.model.stat.graph.graphPeopleStatData.unsubscribedDataSet,
                        fill: false,
                        borderColor: '#b05c91',
                        backgroundColor: '#b05c91'
                    }]
                });
                //График посещаемости и просмотров
                if (graphModel.attendanceStatGraph) {
                    graphModel.attendanceStatGraph.destroy();
                }

                graphModel.attendanceStatGraph.showGraph({
                    element: "attendanceStatGraph",
                    labels: $scope.model.stat.graph.attendanceStatData.labels,
                    datasets: [{
                        label: "Просмотров",
                        data: $scope.model.stat.graph.attendanceStatData.viewsData,
                        fill: false,
                        borderColor: '#597da3',
                        backgroundColor: '#597da3',
                        pointBorderWidth: 2,
                        pointHoverRadius: 3
                    }, {
                        label: "Посещений",
                        data: $scope.model.stat.graph.attendanceStatData.visitorsData,
                        fill: false,
                        borderColor: '#b05c91',
                        backgroundColor: '#b05c91'
                    }]
                });
                //График динамики вовлеченности
                if (graphModel.wallERGraph) {
                    graphModel.wallERGraph.destroy();
                }

                graphModel.wallERGraph.showGraph({
                    element: "wallERGraph",
                    labels: $scope.model.wall.dayGroups.map((item)=> {
                        return item.date;
                    }),
                    datasets: [{
                        label: "Суммарная вовлеченность за день",
                        data: $scope.model.wall.dayGroups.map((item)=> {
                            return item.postER;
                        }),
                        fill: false,
                        borderColor: '#597da3',
                        backgroundColor: '#597da3',
                        pointBorderWidth: 2,
                        pointHoverRadius: 3
                    }]
                });
                //График среднего охвата постов
                if (graphModel.averageDayGraphReport) {
                    graphModel.averageDayGraphReport.destroy();
                }

                graphModel.averageDayGraphReport.showGraph({
                    element: "averageDayGraphReport",
                    labels: $scope.model.wall.dayGroups.map((item)=> {
                        return item.date;
                    }),
                    datasets: [{
                        label: "Средний охват постов в день",
                        data: $scope.model.wall.dayGroups.map((item)=> {
                            return item.viewsAverage;
                        }),
                        fill: false,
                        borderColor: '#597da3',
                        backgroundColor: '#597da3',
                        pointBorderWidth: 2,
                        pointHoverRadius: 3
                    }]
                });

                //График добавления постов (отчет)
                if (graphModel.postDayGraphReport) {
                    graphModel.postDayGraphReport.destroy();
                }

                graphModel.postDayGraphReport.showGraph({
                    element: "postDayGraphReport",
                    labels: $scope.model.wall.dayGroups.map((item)=> {
                        return item.date;
                    }),
                    datasets: [{
                        label: "Постов добавлено",
                        data: $scope.model.wall.dayGroups.map((item)=> {
                            return item.postsCount;
                        }),
                        fill: false,
                        borderColor: '#597da3',
                        backgroundColor: '#597da3',
                        pointBorderWidth: 2,
                        pointHoverRadius: 3
                    }]
                });
                //График добавления постов
                if (graphModel.postDayGraph) {
                    graphModel.postDayGraph.destroy();
                }

                graphModel.postDayGraph.showGraph({
                    element: "postDayGraph",
                    labels: $scope.model.wall.dayGroups.map((item)=> {
                        return item.date;
                    }),
                    datasets: [{
                        label: "Постов добавлено",
                        data: $scope.model.wall.dayGroups.map((item)=> {
                            return item.postsCount;
                        }),
                        fill: false,
                        borderColor: '#597da3',
                        backgroundColor: '#597da3',
                        pointBorderWidth: 2,
                        pointHoverRadius: 3
                    }]
                });
            }

            function openDatepickerPopupFrom() {
                $scope.model.datePicker.popupFrom.opened = !$scope.model.datePicker.popupFrom.opened;
            }

            function openDatepickerPopupTo() {
                $scope.model.datePicker.popupTo.opened = !$scope.model.datePicker.popupTo.opened;
            }

            function getDate(date) {
                return moment(date * 1000).format("DD.MM.YYYY HH:mm")
            }

            function calculateWallStat(data) {
                var wall = getNulledWall();
                wall.allPostsCount = data.count;//Всего записей на стене
                wall.periodPostsCount = data.list.length;//Количество записей за период
                var ER = 0;
                data.list.forEach(function (post) {
                    wall.list.push(post);

                    wall.likes.count += post.likes.count || 0;
                    wall.reposts.count += post.reposts.count || 0;
                    wall.comments.count += post.comments.count || 0;
                    wall.views.averageByPost += post.views && post.views.count ? post.views.count : 0;
                    wall.views.max = post.views && post.views.count && post.views.count > wall.views.max ? post.views.count : wall.views.max;
                    wall.views.min = post.views && post.views.count && post.views.count < wall.views.min ? post.views.count : wall.views.min;
                    if (!wall.views.min && post.views && post.views.count) {
                        wall.views.min = post.views.count;
                    }
                    if (post.marked_as_ads) {
                        wall.ads.count++;
                        wall.views.maxAds = post.views && post.views.count && post.views.count > wall.views.maxAds ? post.views.count : wall.views.maxAds;
                    }

                    var date = new Date(post.date * 1000);
                    var postDate = date.getDate() + "." + (date.getMonth() + 1) + "." + date.getFullYear();
                    var postER = calcERByMembers(post, undefined);
                    ER += parseFloat(postER);

                    if (wall.ERMax < postER) {
                        wall.ERMax = postER;
                    }

                    var currDay = wall.dayGroups.filter((day)=> {
                        return day.date == postDate;
                    })[0];

                    if (!currDay) {
                        wall.dayGroups.push({
                            likes: post.likes.count || 0,//Лайков
                            reposts: post.reposts.count || 0,//Репостов
                            comments: post.comments.count || 0,//комментариев
                            summActions: (post.likes.count || 0) + (post.reposts.count || 0) + (post.comments.count || 0),//Суммарно реакций
                            postER: postER,//вовлеченность постов суммарная
                            viewsAverage: post.views && post.views.count ? post.views.count : 0,//Просмотров в среднем за день
                            postsCount: 1,//Количество постов в текущий день
                            date: postDate,
                            datetime: new Date(date.getFullYear(), date.getMonth(), date.getDate())
                        });
                    } else {
                        currDay.likes += post.likes.count || 0;//Лайков
                        currDay.reposts += post.reposts.count || 0;//Репостов
                        currDay.comments += post.comments.count || 0;//комментариев
                        currDay.summActions += (post.likes.count || 0) + (post.reposts.count || 0) + (post.comments.count || 0);//Суммарно реакций
                        var t = currDay.postER;
                        currDay.postER = (parseFloat(t) + parseFloat(postER)).toFixed(3);//вовлеченность постов суммарная
                        currDay.viewsAverage += post.views && post.views.count ? post.views.count : 0;//Просмотров в среднем за день
                        currDay.postsCount++;//Количество постов в текущий день
                    }
                });

                wall.averagePostsByDay = wall.dayGroups.length ? (wall.periodPostsCount / wall.dayGroups.length).toFixed(1) : 0;//В среднем постов день
                wall.ERAverage = wall.periodPostsCount ? (ER / wall.periodPostsCount).toFixed(3) : 0;//Средняя вовлеченность на пост по количеству постов
                wall.actionsCount = wall.likes.count + wall.reposts.count + wall.comments.count;//Суммарно реакций на стене
                wall.views.averageByPost = wall.periodPostsCount ? (wall.views.averageByPost / wall.periodPostsCount).toFixed(1) : 0;//В среднем просмотров на запись
                wall.actionsAverageByDay = wall.dayGroups.length ? (wall.actionsCount / wall.dayGroups.length).toFixed(1) : 0;//Среднее число реакций в день
                wall.actionsAverageByPost = wall.periodPostsCount ? (wall.actionsCount / wall.periodPostsCount).toFixed(1) : 0;//Среднее число реакций на пост


                wall.dayGroups.forEach((item)=> {
                    item.viewsAverage = item.postsCount ? (item.viewsAverage / item.postsCount).toFixed(1) : 0;
                });

                wall.dayGroups.sort((a, b)=> {
                    if (new Date(a.datetime) > new Date(b.datetime))
                        return 1;
                    else return -1;
                });

                return wall;
            }

            function calculatePhotoStat(data) {
                var photo = getNulledPhoto();
                photo.allCount = data.count;//Количество постов за период

                data.list.forEach(function (item) {
                    photo.photoPeriodCount++;//Количество фото за период
                    photo.likesPeriodCount += item.likes.count || 0;//Количество фото за период
                    photo.repostsPeriodCount += item.reposts.count || 0;
                });

                return photo;
            }

            function calcERByMembers(post, membersCount) {
                if (!membersCount)
                    membersCount = $scope.model.groupInfo.membersCount;

                if (membersCount && post.likes && post.reposts && post.comments) {
                    var postER = (post.likes.count + post.reposts.count + post.comments.count) / membersCount * 100;
                    postER = postER.toFixed(3);

                    return postER;
                }

                return (0).toFixed(3);
            }

            function calculatePhotoCommentsStat(data) {
                return {
                    allCount: data.allCount || 0,
                    periodCount: data.periodCount || 0,
                    list: data.list
                }
            }

            function calculateVideoStat(data) {
                var video = getNulledVideo();
                video.allCount = data.count;

                data.list.forEach(function (item) {
                    video.videoPeriodCount++;//Количество фото за период
                    video.likesPeriodCount += item.likes.count || 0;//Количество фото за период
                    video.repostsPeriodCount += item.reposts.count || 0;
                });

                return video;
            }

            function getNulledWall() {
                return {
                    allPostsCount: 0,//Всего записей на стене
                    averagePostsByDay: 0,//В среднем постов в день
                    periodPostsCount: 0,//Записей за период
                    list: [],//список записей
                    showedList: [],//список отображаемых записей в анализе публикаций
                    showedListPage: 1,//Номер отображаемой страницы
                    likes: {
                        count: 0,//Лайков за период
                    },
                    reposts: {
                        count: 0,//Репостов за период
                    },
                    comments: {
                        count: 0,//Комментариев за период
                    },
                    actionsCount: 0,//Суммарно реакций
                    actionsAverageByDay: 0,//Средняя реакция в день
                    actionsAverageByPost: 0,//Средняя реакция на пост
                    views: {
                        count: 0,//Просмотров за период
                        max: 0,//Максимальное число просмотров у записи
                        min: undefined,//Минимальное число просмотров у записи
                        maxAds: 0,//Максимальное число просмотров рекламной записи,
                        averageByPost: 0//Среднее число просмотров поста
                    },
                    ads: {
                        count: 0//Количество рекламных записей
                    },
                    ERMax: 0,//Максимальная вовлеченность на пост
                    ERAverage: 0,//Средняя вовлеченность на пост
                    dayGroups: [],//Данные по дням
                }
            }

            function getNulledPhoto() {
                return {
                    allCount: 0,
                    photoPeriodCount: 0,
                    likesPeriodCount: 0,
                    repostsPeriodCount: 0
                }
            }

            function getNulledVideo() {
                return {
                    allCount: 0,
                    videoPeriodCount: 0,
                    likesPeriodCount: 0,
                    repostsPeriodCount: 0
                }
            }

            function sortPostsList(filter) {
                if (!filter) {
                    filter = $scope.model.postsFilter;
                }
                if (filter == 'likes') {//Фильтр по лайкам
                    $scope.model.wall.list = _.sortBy($scope.model.wall.list, function (o) {
                        if (o.likes && o.likes.count)
                            return o.likes.count;
                        else
                            return 0;
                    }).reverse();
                }
                if (filter == 'reposts') {//Фильтр по лайкам
                    $scope.model.wall.list = _.sortBy($scope.model.wall.list, function (o) {
                        if (o.likes && o.reposts.count)
                            return o.reposts.count;
                        else
                            return 0;
                    }).reverse();
                }
                if (filter == 'comments') {//Фильтр по лайкам
                    $scope.model.wall.list = _.sortBy($scope.model.wall.list, function (o) {
                        if (o.likes && o.comments.count)
                            return o.comments.count;
                        else
                            return 0;
                    }).reverse();
                }

                if (filter == 'ER') {//Фильтр по ER
                    $scope.model.wall.list = _.sortBy($scope.model.wall.list, function (o) {
                        if (o.likes && o.ER)
                            return o.ER;
                        else
                            return 0;
                    }).reverse();
                }

                $scope.model.wall.showedList = [];
                $scope.model.wall.showedListPage = 1;

                $timeout(()=> {
                    for (var i = 0; i < 20; i++) {
                        if ($scope.model.wall.list[i])
                            $scope.model.wall.showedList.push($scope.model.wall.list[i]);
                        else i = 20;
                    }
                });
            }

            function nextPosts() {
                if ($scope.model.wall.showedList.length < $scope.model.wall.list.length) {
                    $scope.model.wall.showedListPage++;
                    $timeout(()=> {
                        for (var i = 20 * ($scope.model.wall.showedListPage - 1); i < 20 * $scope.model.wall.showedListPage; i++) {
                            if ($scope.model.wall.list[i])
                                $scope.model.wall.showedList.push($scope.model.wall.list[i]);
                            else i = 20 * $scope.model.wall.showedListPage;
                        }
                    });
                }
            }

            function getAuditory() {

                var deferr = $.Deferred();
                var userList = [];

                recursive(0).then(()=> {
                    console.log("Все ок!");
                    console.log(userList);
                });

                function recursive(iteration) {
                    vkApiFactory.execute.getGroupMembers(authData, {
                        groupId: $scope.model.groupInfo.gid,
                        offset: iteration * 25000,
                        fields: 'first_name'
                    }).then(function (res) {
                        if (res && res.error && res.error && res.error.error_code == 6) {
                            setTimeout(function () {
                                recursive(iteration);
                            }, 800);
                            return;
                        }

                        console.log("Считано: " + (iteration + 1) * 25000 + " пользователей");

                        if (res && !res.error) {
                            res.forEach((item)=> {
                                if (item.items && item.items.length)
                                    Array.prototype.push.apply(userList, item.items);
                            });

                            if ((iteration * 25000) < $scope.model.groupInfo.membersCount) {
                                recursive(iteration + 1);
                            } else {
                                deferr.resolve();
                            }
                        }

                        if (!res) {
                            deferr.reject();
                        }
                    }).fail(function (err) {
                        deferr.reject();
                    });

                    return deferr.promise();
                }
            }

            init();


        }

    ]);