import events from './../../../../bl/events.js';
import topics from './../../../../bl/topics.js';
import {enums} from './../../../../bl/module.js';

angular
    .module('rad.stat')
    .controller('findBotsController', ['$rootScope', '$scope', '$state', 'bus', 'statPopupsFactory', 'appState', 'vkApiFactory', 'memoryFactory', '$timeout', 'radCommonFunc', '$stateParams', 'notify',
        function ($rootScope, $scope, $state, bus, statPopupsFactory, appState, vkApiFactory, memoryFactory, $timeout, radCommonFunc, $stateParams, notify) {
            $scope.statIsLoaded = false;
            $scope.isLoading = false;
            $scope.isHiddenMenu = true;
            $scope.showGroupsMenu = showGroupsMenu;
            $scope.setGroupLink = setGroupLink;
            $scope.nextProgressStep = nextProgressStep;
            $scope.getXlsReport = getXlsReport;
            $scope.find = find;

            var groupStats = {
                members: [],
                allCount: 0,
                deactivatedCount: 0,
                gid: ''
            };
            var chart;
            var needGetStatFromParams = $stateParams.getStatFromGroup ? $stateParams.getStatFromGroup : false;

            $scope.model = {
                groupAddress: '',
                groupName: '',
                deactivatedList: [],
                deactivatedListView: [],
                deactivatedCount: 0,
                title: "Поиск &laquo;мертвых&raquo; подписчиков"
            };

            $scope.$watch('isLoading', (newVal)=>{
                $rootScope.globalLoading = newVal;
            });

            var authData = {
                token: appState.getUserVkToken(),
                login: appState.getUserVkLogin()
            };

            $scope.$watch('model.groupAddress', (newVal, oldVal)=> {
                if (newVal != oldVal)
                    $scope.urlError = "";
            });

            function showGroupsMenu() {
                $scope.isHiddenMenu = !$scope.isHiddenMenu;
            }

            function setGroupLink(group) {
                $scope.model.groupAddress = "https://vk.com/" + group.screen_name;
                $scope.isHiddenMenu = true;
            }

            function nextProgressStep(step) {
                if (step == 0 || !step) {
                    return;
                }

                var progressPercent = parseFloat($scope.progressPercent);
                progressPercent += parseFloat(step);
                progressPercent = progressPercent.toFixed(2);

                $timeout(()=> {
                    if (progressPercent < 100) {
                        $scope.progressPercent = progressPercent;
                    }
                });
            }

            function getMemoryData() {
                var lastData = memoryFactory.getMemory('findBotsModel');
                if (lastData) {
                    $timeout(()=> {

                        $scope.model = lastData;
                        $scope.statIsLoaded = true;

                        setTimeout(()=>{
                            renderChart.start($scope.model.charData);
                            $(".nano").nanoScroller();
                        }, 500);
                    });
                }
            }

            function find() {
                if (!appState.isActiveUser()){
                    bus.publish(events.ACCOUNT.SHOW_PERIOD_FINISHED_MODAL);
                    return;
                }

                if (!$scope.model.groupAddress) {
                    $scope.urlError = 'Укажите адрес или символьный код группы';
                    return;
                }

                var vkGroupId = radCommonFunc.getGroupId($scope.model.groupAddress);
                var deferr = $.Deferred();

                $timeout(()=> {
                    $scope.progressPercent = 0;
                    $scope.groupIsFinded = false;
                });

                groupStats = {
                    members: [],
                    allCount: 0,
                    deactivatedCount: 0,
                    deactivatedList: 0,
                    gid: '',
                    name: '',
                    photoUrl: ''
                };

                var groupInfoRequest = vkApiFactory.getGroupInfo(authData, {
                    groupId: vkGroupId,
                    fields: "photo_big,photo_medium,photo,members_count,counters,description"
                }).then(function (res) {
                    if (res && res.error && res.error.error_code == 100) {
                        $scope.$apply(function () {
                            $scope.urlError = 'Введеная группа вконтакте не найдена';
                            $scope.isLoading = false;
                            $scope.statIsLoaded = false;
                        });
                        return;
                    }

                    $scope.$apply(function () {
                        groupStats.allCount = res.members_count;
                        groupStats.gid = res.gid;
                        groupStats.name = res.name;
                        groupStats.photoUrl = res.photoUrl;

                        $scope.model.membersCount = res.members_count;
                        $scope.model.groupName = res.name;
                        $scope.model.groupScreenName = res.screen_name;
                        $scope.model.groupPhoto = res.photo_big || res.photo_medium || res.photo;
                        $scope.model.groupDescription = res.description;
                        $scope.model.groupMembersCount = res.members_count;
                    });
                });

                groupInfoRequest.then(()=> {
                    if ($scope.urlError) {
                        return;
                    }

                    $scope.$apply(()=> {
                        $scope.isLoading = true;
                        $scope.groupIsFinded = true;
                    });

                    $timeout(()=> {
                        $(".nano").nanoScroller();
                    }, 200);

                    getGroupMembers().then(()=> {
                        $timeout(()=> {
                            $scope.isLoading = false;
                            $scope.statIsLoaded = true;

                            memoryFactory.setMemory('findBotsModel', $scope.model);
                        });
                    });
                });

                function getGroupMembers(currIteration) {
                    currIteration = currIteration ? currIteration : 0;
                    vkApiFactory.execute.getGroupMembers(authData, {
                        groupId: groupStats.gid,
                        offset: currIteration * 25000,
                        fields: "last_seen"
                    }).then((res)=> {

                        if (res && !res.error) {
                            res.forEach((arr)=> {
                                var deactivatedList = arr.users.filter((user)=> {
                                    return user.deactivated != null;
                                });
                                groupStats.members.push(deactivatedList);
                            });

                            if ((currIteration + 1) * 25000 < groupStats.allCount) {

                                $scope.nextProgressStep(100 / (groupStats.allCount / 25000));
                                getGroupMembers(currIteration + 1);
                            } else {
                                var arrValues = [];
                                groupStats.members.forEach((arr)=> {
                                    arrValues = arrValues.concat(arr);
                                });
                                $scope.$apply(()=> {
                                    $scope.model.deactivatedList = arrValues;

                                    for (var i = 0; i < 200; i++) {
                                        if ($scope.model.deactivatedList[i])
                                            $scope.model.deactivatedListView.push($scope.model.deactivatedList[i]);
                                    }

                                    $scope.model.deactivatedCount = $scope.model.deactivatedList.length;
                                    $timeout(()=> {
                                        $scope.model.charData = {
                                            chartId: "bannedChart",
                                            type: 'pie',
                                            data: {
                                                labels: [
                                                    "'Живые' участники",
                                                    "'Мертвые' участники"
                                                ],
                                                datasets: [
                                                    {
                                                        data: [$scope.model.membersCount - $scope.model.deactivatedCount, $scope.model.deactivatedCount],
                                                        backgroundColor: [
                                                            "#6FBF8E",
                                                            "#C24F4F"
                                                        ],
                                                        hoverBackgroundColor: [
                                                            "#97C9AA",
                                                            "#A32A2A"
                                                        ]
                                                    }]
                                            }
                                        };
                                        renderChart.start($scope.model.charData);
                                        $(".nano").nanoScroller();
                                    }, 300);
                                    deferr.resolve();
                                });
                            }
                        } else {
                            $scope.isLoading = false;
                            $scope.statIsLoaded = false;
                            if (!(res && res.error)){
                                notify.error("Странно, но вконтакте не вернул никаких данных. Пожалуйста, сообщите нам об этом.");
                            }
                        }

                    }).fail(()=> {
                        deferr.reject();
                        notify.error("Не удалось выгрузить статистику по подписчикам группы");
                    });

                    return deferr.promise();
                }
            }

            function getXlsReport() {
                if ($scope.model && $scope.model.deactivatedCount && $scope.model.deactivatedCount > 0) {
                    $scope.isLoading = true;
                    var date = new Date();
                    var dateCreate = date.getDate() + "." + date.getMonth() + "." + date.getFullYear() + " " + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
                    var iteration = 0;

                    requestReport();

                    function requestReport() {
                        var list = [];
                        if ($scope.model.deactivatedList.length > 1000) {
                            for (var i = iteration * 1000; i < (iteration + 1) * 1000; i++) {
                                if ($scope.model.deactivatedList[i])
                                    list.push($scope.model.deactivatedList[i]);
                            }
                        } else {
                            list = $scope.model.deactivatedList;
                        }
                        bus.request(topics.REPORTS.GET_BANNED_LIST, {
                            list: JSON.stringify(list),
                            count: $scope.model.deactivatedCount,
                            groupName: $scope.model.groupName,
                            dateCreate: dateCreate,
                            offset: (iteration + 1) * 1000,
                            iteration: iteration
                        })
                            .then((result)=> {
                                if (result.success) {
                                    if ((iteration + 1) * 1000 < $scope.model.deactivatedList.length) {
                                        iteration++;
                                        requestReport();
                                    } else {
                                        $timeout(()=> {
                                            $scope.isLoading = false;
                                        });
                                        notify.success("Отчет сформирован. Убедитесь, что для сайта socstat.ru разрешены всплывающие окна.");
                                        window.location.href = result.reportUrl;
                                    }
                                } else {
                                    $timeout(()=> {
                                        $scope.isLoading = false;
                                    });
                                    notify.error("Не удалось сформировать отчет - произошла ошибка. Пожалуйста, сообщите нам об этом.");
                                }
                            })
                            .fail(()=> {
                                $timeout(()=> {
                                    $scope.isLoading = false;
                                });
                                notify.error("Не удалось сформировать отчет - произошла ошибка. Пожалуйста, сообщите нам об этом.");
                            });
                    }
                } else {
                    notify.error("Не удалось сформировать отчет -  нет необходимых данных");
                }
            }

            var renderChart = (function (){
                var chart;
                var ctx;
                var startRender;
                var chartData;
                var start = function(params){
                    if (chart){
                        chart.destroy();
                        chart = undefined;
                    }
                    chartData = params;
                    ctx = document.getElementById(chartData.chartId).getContext("2d");
                    render();
                    initHandlers();
                };
                var render = function(){
                    ctx.canvas.height = 180;
                    ctx.canvas.width = $("#" + chartData.chartId).parent().width();

                    chart = new Chart(ctx,{
                        type: chartData.type,
                        data: chartData.data
                    });

                    startRender = false;
                };
                var initHandlers = function (){
                    $(window).resize(function () {
                        if (startRender)
                            return;

                        startRender = true;
                        setTimeout(function () {
                            render();
                        }, 200);
                    });
                };
                return {
                    start: start
                }
            })();

            function init() {

                getMemoryData();

                $(function () {
                    $('[data-toggle="tooltip"]').tooltip();
                });

                if (needGetStatFromParams) {
                    $scope.model.groupAddress = needGetStatFromParams;
                    find();
                    notify.info("Процесс поиска мертвых участников начался. Пожалуйста подождите.");
                }

                $(".nano").nanoScroller();
            }

            init();

        }

    ]);