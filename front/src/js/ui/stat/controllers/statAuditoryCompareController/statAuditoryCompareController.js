import events from './../../../../bl/events.js';
import topics from './../../../../bl/topics.js';
import {enums} from './../../../../bl/module.js';

angular
    .module('rad.stat')
    .controller('statAuditoryCompareController', ['$rootScope', '$scope', '$state', 'bus', 'statPopupsFactory', 'appState', 'vkApiFactory', '$timeout', 'radCommonFunc', 'notify', 'memoryFactory', '$stateParams',
        function ($rootScope, $scope, $state, bus, statPopupsFactory, appState, vkApiFactory, $timeout, radCommonFunc, notify, memoryFactory, $stateParams) {
            $scope.model = {
                groupAddress1: '',
                groupAddress2: '',
                differences: 0,
                title: 'Сравнение аудиторий'
            };
            $scope.dataIsLoaded = false;

            $scope.adminGroups = [];
            $scope.compare = compare;
            $scope.dataIsLoaded = false;
            $scope.isLoading = false;
            $scope.groupIsFinded = false;
            $scope.progressPercent = 0;
            $scope.progressUserPercent = 0;
            $scope.isUserGetData = false;

            $scope.model = {
                countOfGroups: 2,
                groups: [],
                intersectionList: [],
                intersectionListView: []
            };

            $scope.getXlsReport = getXlsReport;

            $scope.request = {};

            $scope.$watch('isLoading', (newVal)=> {
                $rootScope.globalLoading = newVal;
            });

            $scope.$watch('model.groups[0].groupAddress', (newVal, oldVal)=> {
                if (newVal != oldVal && $scope.model.groups[0])
                    $scope.model.groups[0].urlError = "";
            });

            $scope.$watch('model.groups[1].groupAddress', (newVal, oldVal)=> {
                if (newVal != oldVal && $scope.model.groups[1])
                    $scope.model.groups[1].urlError = "";
            });

            $scope.$watch('model.groups[2].groupAddress', (newVal, oldVal)=> {
                if (newVal != oldVal && $scope.model.groups[2])
                    $scope.model.groups[2].urlError = "";
            });

            $scope.$watch('model.groups[3].groupAddress', (newVal, oldVal)=> {
                if (newVal != oldVal && $scope.model.groups[3])
                    $scope.model.groups[3].urlError = "";
            });

            $scope.$watch('model.groups[4].groupAddress', (newVal, oldVal)=> {
                if (newVal != oldVal && $scope.model.groups[4])
                    $scope.model.groups[4].urlError = "";
            });

            $scope.$watch('isLoading', ()=> {
                if ($scope.isLoading) {
                    $('input').iCheck('disable');
                } else {
                    $('input').iCheck('enable');
                }
            });

            var authData = {
                token: appState.getUserVkToken(),
                login: appState.getUserVkLogin()
            };

            function getAdminGroups() {
                vkApiFactory.getUserGroups(authData, {
                    extended: 1,
                    filter: "moder",
                    count: 1000,
                    fields: ""
                }).then(function (res) {
                    if (res && res[0] > 0) {
                        res = res.slice(1);
                        $scope.adminGroups = res;
                    }
                });
            }

            function compare() {
                if (!appState.isActiveUser()) {
                    bus.publish(events.ACCOUNT.SHOW_PERIOD_FINISHED_MODAL);
                    return;
                }

                var flagStop = false;
                $scope.model.groups.forEach((group, index)=> {
                    if (!group.groupAddress) {
                        group.urlError = 'Укажите адрес или символьный код группы';
                        flagStop = true;
                    }
                    //Проверка одинаковых групп
                    if (index != 0 && group.groupAddress && group.groupAddress == $scope.model.groups[0].groupAddress) {
                        group.urlError = 'Нельзя сравнивать одинаковые группы';
                        flagStop = true;
                    }
                });

                if (flagStop) {
                    return;
                }


                $scope.model.needExtendUser = $('input[name=needExtendUser]:checked').val();

                $scope.model.groups.forEach((group)=> {
                    group.groupId = radCommonFunc.getGroupId(group.groupAddress);
                    group.deffer = $.Deferred();
                    group.members = [];
                });

                $timeout(()=> {
                    $scope.progressPercent = 0;
                    $scope.groupIsFinded = false;
                });

                $scope.model.matches = 0;
                $scope.model.differences = 0;
                $scope.model.intersectionList = [];
                $scope.model.intersectionListView = [];
                $scope.dataIsLoaded = false;

                $scope.model.groups.forEach((group)=> {
                    group.groupRequest = vkApiFactory.getGroupInfo(authData, {
                        groupId: group.groupId
                    }).then(function (res) {
                        if (res && res.error && res.error.error_code == 100) {
                            $scope.$apply(function () {
                                group.urlError = 'Введеная группа вконтакте не найдена';
                                $scope.isLoading = false;
                                $scope.dataIsLoaded = false;
                            });
                            return;
                        }

                        $scope.$apply(function () {
                            group.info = {
                                gid: res.gid,
                                count: res.members_count,
                                name: res.name,
                                photoUrl: res.photo_big
                            }
                        });
                    });
                    group.membersDone = $.Deferred();
                    group.getMembers = function (groupId, iteration, progress) {
                        vkApiFactory.execute.getGroupMembers(authData, {
                            groupId: groupId,
                            offset: iteration * 25000,
                            fields: ''
                        }).then(function (res) {
                            if (res && res.error && res.error && res.error.error_code == 6) {
                                setTimeout(function () {
                                    group.getMembers(groupId, iteration, progress);
                                }, 800);
                                return;
                            }

                            if (progress) {
                                $scope.progressPercent = (100 / group.info.count) * (iteration * 25000)
                                $scope.$apply(()=> {
                                    $scope.progressPercent = $scope.progressPercent.toFixed(2);
                                });
                            }

                            if (res && !res.error) {
                                res.forEach((item)=> {
                                    if (item.users && item.users.length)
                                        group.members = group.members.concat(item.users);
                                });

                                if (group.members.length < group.info.count) {
                                    group.getMembers(groupId, iteration + 1, progress);
                                } else {
                                    group.membersDone.resolve();
                                }
                            }

                            if (!res) {
                                group.membersDone.reject();
                            }
                        }).fail(function (err) {
                            group.membersDone.reject();
                        });

                        return group.membersDone.promise();
                    }
                });

                $.when(
                    $scope.model.groups[0] ? $scope.model.groups[0].groupRequest : true,
                    $scope.model.groups[1] ? $scope.model.groups[1].groupRequest : true,
                    $scope.model.groups[2] ? $scope.model.groups[2].groupRequest : true,
                    $scope.model.groups[3] ? $scope.model.groups[3].groupRequest : true,
                    $scope.model.groups[4] ? $scope.model.groups[4].groupRequest : true
                )
                    .then(()=> {
                        var flagStop = false;
                        $scope.model.groups.forEach((group)=> {
                            if (group.urlError) {
                                flagStop = true;
                            }
                        });
                        if (flagStop) {
                            return;
                        }

                        $scope.$apply(()=> {
                            $scope.isLoading = true;
                            $scope.groupIsFinded = true;
                        });

                        $timeout(()=> {
                            $(".nano").nanoScroller();
                        }, 200);

                        var max = _.maxBy($scope.model.groups, function (group) {
                            return group.info.count;
                        });
                        $scope.model.groups.forEach((group)=> {
                            if (group.info.count == max.info.count) {
                                group.isMax = true;
                            }
                        });
                        $.when(
                            $scope.model.groups[0] ? $scope.model.groups[0].getMembers($scope.model.groups[0].info.gid, 0, $scope.model.groups[0].isMax) : true,
                            $scope.model.groups[1] ? $scope.model.groups[1].getMembers($scope.model.groups[1].info.gid, 0, $scope.model.groups[1].isMax) : true,
                            $scope.model.groups[2] ? $scope.model.groups[2].getMembers($scope.model.groups[2].info.gid, 0, $scope.model.groups[2].isMax) : true,
                            $scope.model.groups[3] ? $scope.model.groups[3].getMembers($scope.model.groups[3].info.gid, 0, $scope.model.groups[3].isMax) : true,
                            $scope.model.groups[4] ? $scope.model.groups[4].getMembers($scope.model.groups[4].info.gid, 0, $scope.model.groups[4].isMax) : true
                        ).then(()=> {
                                //Сравнение массивов
                                $scope.$apply(()=> {
                                    var intersection = $scope.model.groups[0].members;
                                    $scope.model.groups.forEach((group)=> {
                                        intersection = _.intersection(
                                            intersection,
                                            group.members
                                        );
                                    });
                                    $scope.model.intersection = intersection;

                                    $scope.model.groups.forEach((group)=> {
                                        group.intersectionPercent = ((intersection.length / group.info.count) * 100).toFixed(2);
                                    });

                                    if ($scope.model.needExtendUser) {
                                        getUsersInfoByIds();
                                    } else {
                                        $scope.model.intersectionList = intersection;
                                        for (var i = 0; i < 200; i++) {
                                            if ($scope.model.intersectionList[i])
                                                $scope.model.intersectionListView.push($scope.model.intersectionList[i]);
                                        }
                                        $timeout(()=> {
                                            $scope.dataIsLoaded = true;
                                            $scope.isLoading = false;
                                            memoryFactory.setMemory('auditoryCompare', $scope.model);
                                        });
                                    }

                                    $timeout(()=> {
                                        $(".nano").nanoScroller();
                                    }, 200);

                                    $timeout(()=> {
                                        for (var i = 0; i < $scope.model.groups.length; i++) {
                                            new pieChartGroup({
                                                dataset: [$scope.model.intersection.length, $scope.model.groups[i].info.count - $scope.model.intersection.length],
                                                chartId: "pieChartGroup" + $scope.model.groups[i].info.gid
                                            });
                                        }
                                    }, 500);
                                });
                            })
                            .always(()=> {
                                $scope.$apply(()=> {
                                    $scope.dataIsLoaded = true;
                                });
                            });
                    });
            }

            function getUsersInfoByIds(iteration) {
                if (!iteration) {
                    $timeout(()=> {
                        $scope.isUserGetData = true;
                        $scope.progressUserPercent = 0;
                    });
                    iteration = 0;
                }

                var userCount = 300;

                var userIds = "";
                for (var i = userCount * iteration; i < userCount * (iteration + 1); i++) {
                    if ($scope.model.intersection[i]) {
                        userIds += $scope.model.intersection[i];
                    } else {
                        i = userCount * (iteration + 1);
                    }
                    if (i < userCount * (iteration + 1) - 1 && $scope.model.intersection[i]) {
                        userIds += ",";
                    }
                }

                vkApiFactory.execute.getUsersInfoByIds(authData, {
                    userIds: userIds,
                    fields: 'contacts, bdate, city, sex'
                }).then(function (res) {
                    if (res && res.error && res.error && res.error.error_code == 6) {
                        setTimeout(function () {
                            getUsersInfoByIds(iteration);
                        }, 800);
                        return;
                    }
                    if (res) {
                        $scope.model.intersectionList = $scope.model.intersectionList.concat(res);
                        if ((iteration + 1) * userCount < $scope.model.intersection.length) {
                            $timeout(()=> {
                                $scope.progressUserPercent = ((100 / $scope.model.intersection.length) * (iteration + 1) * userCount).toFixed(2);
                            });

                            getUsersInfoByIds(iteration + 1);
                        } else {
                            $timeout(()=> {
                                $scope.progressUserPercent = 100;
                                for (var i = 0; i < 200; i++) {
                                    if ($scope.model.intersectionList[i])
                                        $scope.model.intersectionListView.push($scope.model.intersectionList[i]);
                                }
                                $scope.isLoading = false;
                                $scope.dataIsLoaded = true;
                                $scope.isUserGetData = false;
                                $(".nano").nanoScroller();
                                memoryFactory.setMemory('auditoryCompare', $scope.model);
                            });
                        }
                    }
                });
            }

            function pieChartGroup(res) {
                var startRender = false,
                    currgraph = undefined,
                    chart = undefined;
                var showGraph = function (data) {
                    $("#" + data.chartId).html("");
                    currgraph = data;
                    renderGraph(data);
                    initHandlers();
                };
                var renderGraph = function (data) {
                    if (chart)
                        chart.destroy();

                    var config = peopleStatGraphConfig(data);
                    var ctx = document.getElementById(data.chartId);

                    if (!ctx)
                        return;

                    ctx = ctx.getContext("2d");
                    ctx.clearRect(0, 0, document.getElementById(data.chartId).width, document.getElementById(data.chartId).height);
                    ctx.canvas.height = 180;
                    ctx.canvas.width = $("#" + data.chartId).parent().width();

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
                        type: 'pie',
                        data: {
                            labels: ["Пересечения", "Различия"],
                            datasets: [{
                                data: data.dataset,
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
                    }
                };

                showGraph(res);
            }

            function setGroupsCount() {
                if ($scope.isLoading) {
                    return;
                }
                $timeout(()=> {
                    $scope.model.countOfGroups = $('input[name=countOfGroups]:checked').val();
                    for (var i = 0; i < $scope.model.countOfGroups; i++) {
                        if (!$scope.model.groups[i]) {
                            $scope.model.groups.push({
                                groupAddress: "",
                                isHiddenMenu: true,
                                showGroupsMenu: function () {
                                    this.isHiddenMenu = !this.isHiddenMenu;
                                },
                                urlError: '',
                                setGroupLink: function (group, i) {
                                    $scope.model.groups[i].groupAddress = "https://vk.com/" + group.screen_name;
                                    $scope.model.groups[i].isHiddenMenu = true;
                                },
                                members: [],
                                info: {}
                            });
                        }
                    }
                    for (var i = $scope.model.countOfGroups; i < 5; i++) {
                        if ($scope.model.groups[i]) {
                            $scope.model.groups.splice(i, 1);
                        }
                    }
                });
            }

            function getMemoryData() {
                var lastData = memoryFactory.getMemory('auditoryCompare');
                if (lastData) {
                    $timeout(()=> {

                        $scope.model = lastData;
                        $scope.dataIsLoaded = true;
                    });
                    $timeout(()=> {
                        for (var i = 0; i < $scope.model.groups.length; i++) {
                            new pieChartGroup({
                                dataset: [$scope.model.intersection.length, $scope.model.groups[i].info.count - $scope.model.intersection.length],
                                chartId: "pieChartGroup" + $scope.model.groups[i].info.gid
                            });
                        }
                        $(".nano").nanoScroller();
                    }, 500);
                }
            }

            function getXlsReport() {
                if ($scope.model && $scope.model.intersectionList && $scope.model.intersectionList.length > 0) {
                    $scope.isLoading = true;
                    var date = new Date();
                    var dateCreate = date.getDate() + "." + date.getMonth() + "." + date.getFullYear() + " " + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
                    var iteration = 0;

                    requestReport();

                    function requestReport() {
                        var list = [];
                        if ($scope.model.intersectionList.length > 1000) {
                            for (var i = iteration * 1000; i < (iteration + 1) * 1000; i++) {
                                if ($scope.model.intersectionList[i])
                                    list.push($scope.model.intersectionList[i]);
                            }
                        } else {
                            list = $scope.model.intersectionList;
                        }
                        bus.request(topics.REPORTS.GET_COMPARE_LIST, {
                            list: JSON.stringify(list),
                            count: $scope.model.intersectionList.length,
                            dateCreate: dateCreate,
                            offset: (iteration + 1) * 1000,
                            iteration: iteration
                        })
                            .then((result)=> {
                                if (result.success) {
                                    if ((iteration + 1) * 1000 < $scope.model.intersectionList.length) {
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

            function init() {
                $("#groupCountList input").on("ifChanged", function (res) {
                    if (res.currentTarget.checked == true) {
                        setGroupsCount();
                    }
                });
                getAdminGroups();
                getMemoryData();
                setGroupsCount();

                $('.icheck').iCheck({
                    checkboxClass: 'icheckbox_flat-blue',
                    radioClass: 'iradio_flat-blue'
                });
            }

            init();

        }])
;