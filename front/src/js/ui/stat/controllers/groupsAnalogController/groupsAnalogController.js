import events from './../../../../bl/events.js';
import topics from './../../../../bl/topics.js';
import {enums} from './../../../../bl/module.js';

angular
    .module('rad.stat')
    .controller('groupsAnalogController', ['$rootScope', '$scope', '$state', 'bus', 'statPopupsFactory', 'appState', 'vkApiFactory', 'memoryFactory', '$timeout', 'radCommonFunc', '$stateParams', 'notify',
        function ($rootScope, $scope, $state, bus, statPopupsFactory, appState, vkApiFactory, memoryFactory, $timeout, radCommonFunc, $stateParams, notify) {
            $scope.currentTab = 'catalog';
            $rootScope.page.sectionTitle = 'Где еще сидят подписчики';

            $scope.statIsLoaded = false;
            $scope.isLoading = false;
            $scope.isHiddenMenu = true;
            $scope.showGroupsMenu = showGroupsMenu;
            $scope.setGroupLink = setGroupLink;
            $scope.nextProgressStep = nextProgressStep;
            $scope.getXlsReport = getXlsReport;
            $scope.find = find;

            var authData = {
                token: appState.getUserVkToken(),
                login: appState.getUserVkLogin()
            };

            $scope.optionsCount = [
                {
                    value: 500,
                    time: '7 секунд'
                },
                {
                    value: 1000,
                    time: '14 секунд'
                },
                {
                    value: 2000,
                    time: '28 секунд'
                },
                {
                    value: 5000,
                    time: '1 минута 6 секунд'
                },
                {
                    value: 10000,
                    time: '2 минуты 12 секунд'
                },
                {
                    value: 15000,
                    time: '3 минуты 18 секунд'
                },
                {
                    value: 20000,
                    time: '4 минуты 24 секунды'
                },
                {
                    value: 30000,
                    time: '6 минут 40 секунд'
                },
                {
                    value: 60000,
                    time: '13 минут 20 секунд'
                }
            ];

            $scope.model = {
                groupAddress: '',
                countOfSubscribers: '',
                calculateTime: ''
            };

            $scope.$watch('model.countOfSubscribers', (newVal)=> {
                var index;
                $scope.optionsCount.forEach((item, i)=> {
                    if (item.value == $scope.model.countOfSubscribers) {
                        index = i;
                    }
                });
                $scope.countError = '';
                if (index || index == 0) {
                    $timeout(()=>{
                        $scope.model.calculateTime = $scope.optionsCount[index].time;
                    });
                }
            });

            var usersGroupsList = [];

            $scope.$watch('isLoading', (newVal)=> {
                $rootScope.globalLoading = newVal;
            });

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

            function find() {
                if (!appState.isActiveUser()){
                    bus.publish(events.ACCOUNT.SHOW_PERIOD_FINISHED_MODAL);
                    return;
                }

                if (!$scope.model.groupAddress) {
                    $scope.urlError = 'Укажите адрес или символьный код группы';
                    return;
                }

                if (!$scope.model.countOfSubscribers){
                    $scope.countError = 'Выберите количество подписчиков для анализа';
                    return;
                }

                var vkGroupId = radCommonFunc.getGroupId($scope.model.groupAddress);
                var deferr = $.Deferred();
                var deferrGroups = $.Deferred();
                var min = $scope.model.countOfSubscribers;

                $timeout(()=> {
                    $scope.progressPercent = 0;
                    $scope.groupIsFinded = false;
                });

                $scope.model.groupStats = {
                    members: [],
                    allCount: 0,
                    deactivatedCount: 0,
                    deactivatedList: 0,
                    gid: '',
                    name: '',
                    photoUrl: ''
                };

                var usersPacks = [];

                var groupInfoRequest = vkApiFactory.getGroupInfo(authData, {
                    groupId: vkGroupId
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
                        $scope.model.groupStats.allCount = res.members_count;
                        $scope.model.groupStats.gid = res.gid;
                        $scope.model.groupStats.name = res.name;
                        $scope.model.groupStats.photoUrl = res.photoUrl;

                        $scope.model.groupStats.membersCount = res.members_count;
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
                        var counter = 0;
                        $scope.model.groupStats.members.forEach((item, i)=> {
                            if (i % 25 == 0 && i != 0) {
                                counter++;
                            }

                            if (i >= min){
                                return;
                            }

                            if (!usersPacks[counter]) {
                                usersPacks[counter] = [];
                            }

                            usersPacks[counter].push(item);
                        });

                        findSubscribersGroups().then(()=> {
                            $timeout(()=> {
                                $scope.isLoading = false;
                                $scope.statIsLoaded = true;

                                var counts = {};
                                for (var i = 0; i < usersGroupsList.length; i++) {
                                    var key = usersGroupsList[i];
                                    counts[key] = {
                                        value: (counts[key]) ? counts[key].value + 1 : 1,
                                        group: key
                                    };
                                }

                                var topGroups = _.sortBy(counts, 'value').reverse();
                                topGroups = topGroups.splice(1, 50);
                                usersGroupsList = [];

                                //Получение информации по группе
                                var groupsString = '';
                                topGroups.forEach((group, i)=> {
                                    if (i != 0) {
                                        groupsString += ",";
                                    }
                                    groupsString += group.group;
                                });
                                vkApiFactory.getGroupsInfo(authData, {
                                    groupIds: groupsString,
                                    fields: "members_count,contacts",
                                    access_token: authData.token
                                }).then((res)=> {
                                    res.forEach((item, i)=> {
                                        item.intersection = topGroups[i].value;
                                    });
                                    $timeout(()=> {
                                        var index;
                                        res.forEach((group, i)=> {
                                            if (group.gid == $scope.model.groupStats.gid) {
                                                index = i;
                                            }
                                        });
                                        if (index) {
                                            res.splice(index, 1);
                                        }
                                        $scope.model.findedGroups = res;
                                        memoryFactory.setMemory('findAnalog', $scope.model);
                                    });
                                });

                            });
                        });
                    });
                });

                function getGroupMembers(currIteration) {
                    currIteration = currIteration ? currIteration : 0;
                    vkApiFactory.execute.getGroupMembers(authData, {
                        groupId: $scope.model.groupStats.gid,
                        offset: currIteration * 25000
                    }).then((res)=> {

                        if (res && !res.error) {
                            res.forEach((arr)=> {
                                $scope.model.groupStats.members = $scope.model.groupStats.members.concat(arr.users);
                            });

                            if (min > $scope.model.groupStats.membersCount)
                                min = $scope.model.groupStats.membersCount;

                            if ((currIteration + 1) * 25000 < min) {

                                $scope.nextProgressStep(20 / (min / 25000));
                                getGroupMembers(currIteration + 1);
                            } else {
                                $scope.nextProgressStep(20);
                                deferr.resolve();
                            }
                        }

                    }).fail(()=> {
                        deferr.reject();
                        notify.error("Не удалось выгрузить статистику по подписчикам группы");
                    });

                    return deferr.promise();
                }

                function findSubscribersGroups(packIndex) {
                    if (!packIndex) {
                        packIndex = 0;
                    }

                    vkApiFactory.execute.getSubscribersGroups(authData, {
                        userIds: usersPacks[packIndex]
                    }).then((res)=> {
                        //console.log(res);
                        if (res.error && res.error.error_code == 6) {
                            setTimeout(()=> {
                                findSubscribersGroups(packIndex);
                            }, 500);
                            return;
                        }

                        $scope.nextProgressStep(80 / (min / 25));

                        res.forEach((groups)=> {
                            if (groups) {
                                groups.splice(0, 1);
                                usersGroupsList = usersGroupsList.concat(groups);
                            }
                        });

                        if (packIndex + 1 < usersPacks.length) {
                            findSubscribersGroups(packIndex + 1);
                        } else {
                            deferrGroups.resolve();
                        }
                    }).fail(()=> {
                        deferrGroups.reject();
                        notify.error("Ошибка");
                    });

                    return deferrGroups.promise();
                }
            }

            function getXlsReport() {
                if ($scope.model && $scope.model.findedGroups && $scope.model.findedGroups.length > 0) {
                    $scope.isLoading = true;
                    var date = new Date();
                    var dateCreate = date.getDate() + "." + date.getMonth() + "." + date.getFullYear() + " " + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
                    var iteration = 0;

                    requestReport();

                    function requestReport() {
                        var list = [];
                        if ($scope.model.findedGroups.length > 1000) {
                            for (var i = iteration * 1000; i < (iteration + 1) * 1000; i++) {
                                if ($scope.model.findedGroups[i])
                                    list.push($scope.model.findedGroups[i]);
                            }
                        } else {
                            list = $scope.model.findedGroups;
                        }
                        bus.request(topics.REPORTS.GET_FIND_ANALOG_LIST, {
                            list: JSON.stringify(list),
                            count: $scope.model.findedGroups.length,
                            dateCreate: dateCreate,
                            offset: (iteration + 1) * 1000,
                            iteration: iteration
                        })
                            .then((result)=> {
                                if (result.success) {
                                    if ((iteration + 1) * 1000 < $scope.model.findedGroups.length) {
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

            function getMemoryData() {
                var lastData = memoryFactory.getMemory('findAnalog');
                if (lastData) {
                    $timeout(()=> {

                        $scope.model = lastData;
                        $scope.statIsLoaded = true;
                    });
                    $timeout(()=> {
                        $(".nano").nanoScroller();
                    }, 500);
                }
            }

            function init() {
                getMemoryData();
                $(function () {
                    $('[data-toggle="tooltip"]').tooltip();
                });

                $(".nano").nanoScroller();
            }

            init();

        }

    ]);