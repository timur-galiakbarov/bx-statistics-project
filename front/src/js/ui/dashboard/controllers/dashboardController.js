import events from './../../../bl/events.js';
import topics from './../../../bl/topics.js';

angular
    .module('rad.dashboard')
    .controller('dashboardController', ['$rootScope', '$scope', 'bus', 'appState', 'vkApiFactory', '$timeout', 'radCommonFunc', 'notify', 'memoryFactory', 'localStorageService', '$state',
        function ($rootScope, $scope, bus, appState, vkApiFactory, $timeout, radCommonFunc, notify, memoryFactory, localStorageService, $state) {

            var parseDate = {};

            $rootScope.page.sectionTitle = '';

            //vars
            $scope.model = {
                groupsStat: [],
                groups: [],
                filter: 'last7days',
                freeList: [],
                freeWithSubscribe: [],
                addGroupInfo: {}
            };

            $scope.ui = {
                isLoading: false,
                periodFrom: "",
                periodTo: "",
                periodLabel: "",
                editListLoading: false,
                freeGroupLoading: false
            };

            var authData = {
                token: appState.getUserVkToken(),
                login: appState.getUserVkLogin()
            };
            var statList = appState.getStatList();

            $scope.showAddGroupList = false;

            //functions proto
            $scope.noActiveTariff = !appState.isActiveUser();
            $scope.addToFreeList = addToFreeList;
            $scope.addFreeGroupRequest = addFreeGroupRequest;
            $scope.setFilter = setFilter;
            $scope.refresh = refresh;
            $scope.openEditGroupsModal = openEditGroupsModal;
            $scope.saveStatList = saveStatList;
            $scope.goToAnalytics = goToAnalytics;

            bus.subscribe(events.ACCOUNT.FREE_GROUP_ADDED, ()=> {
                getFreeGroupsList();
            });

            init();

            function init() {
                $rootScope.setTitle("Главная страница");

                statList = appState.getStatList();
                var filterFromLS = localStorageService.get('dashboardFilter');
                if (filterFromLS) {
                    $scope.model.filter = filterFromLS;
                }

                getFreeGroupsList();
                var lastData = memoryFactory.getMemory("dashboardData");
                if (lastData) {
                    $timeout(()=> {
                        $scope.model.groupsStat = lastData.groupsStat;
                        $scope.model.adminGroups = lastData.adminGroups;
                        $scope.model.groups = lastData.groups;
                        $scope.ui.periodFrom = lastData.fromLabel;
                        $scope.ui.periodTo = lastData.toLabel;
                        $scope.ui.periodLabel = lastData.periodLabel;
                    });
                } else {
                    /*getNewsList();*/
                    getMyAnalytics()
                        .fail(()=> {
                            notify.error("Не удалось получить данные по вашим группам. Нажмите на кнопку 'Обновить'");
                            $timeout(()=> {
                                $scope.ui.isLoading = false;
                            });
                        });
                }

                $('.icheck').iCheck({
                    checkboxClass: 'icheckbox_flat-blue',
                    radioClass: 'iradio_flat-blue'
                });
            }

            function getMyAnalytics() {
                var index = 0;
                var deferr = $.Deferred();
                $scope.ui.isLoading = true;
                parseDate = getCheckedDate();
                $scope.ui.periodFrom = parseDate.fromLabel;
                $scope.ui.periodTo = parseDate.toLabel;

                switch ($scope.model.filter) {
                    case "today":
                        $scope.ui.periodLabel = "сегодня";
                        break;
                    case "yesterday":
                        $scope.ui.periodLabel = "вчера";
                        break;
                    default:
                        $scope.ui.periodLabel = "период с " + $scope.ui.periodFrom + " по " + $scope.ui.periodTo;
                }

                $scope.model.groupsStat = [];

                getAdminGroups()
                    .then((myList)=> {
                        $scope.model.adminGroups = myList;

                        myList = myList.map((item)=> {
                            var editSelected = false;
                            if (statList && statList.length) {
                                editSelected = statList.filter((el)=> {
                                    return el == item.gid;
                                }).length > 0;
                            } else {
                                editSelected = true;
                            }
                            return angular.extend(item, {
                                editSelected: editSelected
                            });
                        });

                        $scope.model.groups = myList.filter((el)=>{
                            return el.editSelected;
                        });

                        $scope.$apply($scope.model.groups);

                        if ($scope.model.groups && $scope.model.groups.length) {
                            getCurrentStat(index);
                        }
                    }).fail(()=> {
                        $timeout(()=> {
                            $scope.ui.isLoading = false;
                        });
                    });

                return deferr.promise();

                function getCurrentStat(index, repeatIndex) {
                    vkApiFactory.getGroupInfo(authData, {
                        groupId: $scope.model.groups[index].gid,
                        fields: "photo_big,photo_medium,photo,members_count,counters,description"
                    }).then(function (res) {

                        if (!res || (res && res.error)) {
                            if (repeatIndex && repeatIndex > 3) {
                                deferr.reject();
                            } else {
                                setTimeout(()=> {
                                    getCurrentStat(index, (repeatIndex || 0) + 1);
                                }, 500);
                            }
                            return;
                        }

                        $scope.model.groupsStat[index] = {};
                        $scope.model.groupsStat[index].groupInfo = {
                            gid: res.gid,
                            members_count: res.members_count,
                            name: res.name,
                            photo_small: res.photo_small,
                            screen_name: res.screen_name
                        };
                        $scope.model.groupsStat[index].visible = false;

                        angular.extend($scope.model.groups[index], res);

                        var filter = {
                            group: $scope.model.groups[index],
                            authData: authData,
                            period: parseDate
                        };

                        $.when(
                            bus.request(topics.STAT.GET_WALL, filter).then((data)=> {
                                $scope.model.groupsStat[index].wall = calculateWallStat(data, $scope.model.groupsStat[index].groupInfo.members_count);
                                $scope.$apply($scope.model.groupsStat[index].wall);
                            }),
                            bus.request(topics.STAT.GET_GROUP_STAT, filter).then((data)=> {
                                $scope.model.groupsStat[index].groupStat = calculateStat(data);
                                $scope.$apply($scope.model.groupsStat[index].groupStat);
                            })
                        )
                            .then(()=> {
                                /*console.log($scope.model.groupsStat[index]);*/

                                $scope.model.groupsStat[index].visible = true;
                                $scope.$apply($scope.model.groupsStat[index].visible);

                                if (index + 1 >= $scope.model.groups.length) {
                                    $scope.ui.isLoading = false;
                                    $scope.$apply($scope.ui.isLoading);
                                    memoryFactory.setMemory('dashboardData', {
                                        groupsStat: $scope.model.groupsStat,
                                        adminGroups: $scope.model.adminGroups,
                                        fromLabel: $scope.ui.periodFrom,
                                        toLabel: $scope.ui.periodTo,
                                        periodLabel: $scope.ui.periodLabel,
                                        groups: $scope.model.groups
                                    });
                                    deferr.resolve();
                                } else {
                                    getCurrentStat(index + 1);
                                }
                            });
                    });
                }
            }

            function calculateStat(data) {
                if (!(data && data.length)) {
                    return {};
                }

                var stat = {
                    subscribed: 0,
                    unsubscribed: 0,
                    reach_subscribers: 0,
                    reach: 0,
                    views: 0,
                    visitors: 0,
                    summ: 0
                };

                data.forEach((item)=> {
                    stat.subscribed += item.subscribed || 0;
                    stat.unsubscribed += item.unsubscribed || 0;
                    stat.reach_subscribers += item.reach_subscribers || 0;
                    stat.reach += item.reach || 0;
                    stat.views += item.views || 0;
                    stat.visitors += item.visitors || 0;
                    stat.summ = stat.subscribed - stat.unsubscribed;
                });

                return stat;
            }

            function getCheckedDate() {
                var dateFrom, dateTo;
                var currDate = new Date();
                currDate.setHours(0, 0, 0, 0);

                switch ($scope.model.filter) {
                    case 'last7days':
                        dateFrom = new Date(currDate).setDate(currDate.getDate() - 6);
                        dateTo = new Date(currDate.getTime() + 24 * 59 * 59 * 1000);
                        break;
                    case 'today':
                        dateFrom = new Date(currDate);
                        dateTo = new Date(currDate.getTime() + 24 * 59 * 59 * 1000);
                        break;
                    case 'yesterday':
                        dateFrom = new Date(currDate).setDate(currDate.getDate() - 1);
                        dateTo = currDate;
                        break;
                    case 'currentMonth':
                        dateFrom = new Date(currDate).setDate(1);
                        dateTo = new Date(currDate.getTime() + 24 * 59 * 59 * 1000);
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
                    default:
                        dateFrom = currDate.setDate(currDate.getDate() - 6);
                        dateTo = new Date(currDate.getTime() + 24 * 59 * 59 * 1000);
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

            function getAdminGroups() {
                var deferr = $.Deferred();
                getRecursive(0);
                return deferr.promise();

                function getRecursive(iteration) {
                    if (!iteration)
                        iteration = 0;

                    if (iteration > 9) {
                        deferr.reject();
                        return;
                    }

                    vkApiFactory.getUserGroups(authData, {
                        extended: 1,
                        filter: "moder",
                        count: 100,
                        fields: "members_count"
                    }).then(function (res) {
                        if (res && res[0] > 0) {
                            res = res.slice(1);
                            deferr.resolve(res);
                        } else {
                            $timeout(()=> {
                                getRecursive(iteration + 1);
                            }, 300);
                        }
                    }).fail(()=> {
                        $timeout(()=> {
                            getRecursive(iteration + 1);
                        }, 300);
                    });
                }
            }

            function getFreeGroupsList() {
                $scope.ui.freeGroupLoading = true;
                $scope.availableToAddCount = 0;

                var freeList = appState.getFreeGroups();
                var listText = "", listSubscribedText = "";
                freeList.free.forEach((item)=> {
                    listText += item;
                    listText += ",";
                });
                freeList.freeWithSubscribedVK.forEach((item)=> {
                    listSubscribedText += item;
                    listSubscribedText += ",";
                });

                if (freeList.free && freeList.free.length) {
                    $.when(
                        getGroupInfoFromVK(0, listText).then((groups)=> {
                            $scope.model.freeList = groups;
                        }),
                        getGroupInfoFromVK(0, listSubscribedText).then((groups)=> {
                            $scope.model.freeWithSubscribe = groups;
                        })
                    ).then(()=> {
                            $timeout(()=> {
                                calcAvailableToAddGroupsCount();
                                $scope.ui.freeGroupLoading = false;
                            });
                        });
                } else {
                    $timeout(()=> {
                        calcAvailableToAddGroupsCount();
                        $scope.ui.freeGroupLoading = false;
                    });
                }
            }

            function calcAvailableToAddGroupsCount() {
                $timeout(()=> {
                    $scope.availableToAddCount = (1 - $scope.model.freeList.length);
                    if (appState.isUserSubscribed()) {
                        $scope.availableToAddCount += (2 - $scope.model.freeWithSubscribe.length);
                    }
                });
            }

            function getGroupInfoFromVK(requestIteration, list) {
                var deferr = $.Deferred();

                getRecursive();

                function getRecursive() {
                    if (requestIteration > 5) {
                        deferr.reject([]);
                        return deferr.promise();
                    }

                    if (!list) {
                        deferr.resolve([]);
                        return deferr.promise();
                    }

                    vkApiFactory.getGroupsInfo(authData, {
                        groupIds: list,
                        fields: "members_count,counters,photo"
                    }).then((groups)=> {
                        if (groups && groups.length) {
                            deferr.resolve(groups);
                        } else {
                            setTimeout(()=> {
                                getRecursive(requestIteration + 1, list);
                            }, 500);
                        }
                    }).fail(()=> {
                        setTimeout(()=> {
                            getRecursive(requestIteration + 1, list);
                        }, 500);
                    });
                }

                return deferr.promise();
            }

            function addToFreeList(event, group) {
                event.stopPropagation();

                if (appState.groupIsFree(group)) {
                    notify.error("Эта группа уже находится в списке бесплатных")
                    return;
                }

                $scope.model.addGroupInfo = group;
                $("#confirmAddGroupToFree").modal('show');
            }

            function addFreeGroupRequest(group) {
                if (appState.groupIsFree(group)) {
                    notify.error("Эта группа уже находится в списке бесплатных")
                    return;
                }

                var source = "free";

                if ($scope.model.freeList.length >= 1) {
                    source = "bySubscribe";
                }

                /*Если source == 'bySubscribe', то необходимо проверить что пользователь подписан на нашу группу*/
                if (source == 'bySubscribe' && !appState.isUserSubscribed()) {
                    notify.error("Для добавления следующих групп необходимо подписаться на нашу группу ВКонтакте. Если вы подписались только что - пожалуйста, перезагрузите страницу");
                    $("#confirmAddGroupToFree").modal('hide');
                    return;
                }

                $scope.ui.freeGroupLoading = true;

                bus.request(topics.ACCOUNT.ADD_FREE_GROUP, {
                    group: group,
                    source: source
                })
                    .then((res)=> {
                        if (res && !res.success) {
                            switch (res.exceptionType) {
                                case 'ScreenNameAlreadyExist':
                                    notify.error("Эта группа уже находится в списке бесплатных");
                                    break;
                                case 'FreeGroupsListIsFull':
                                    notify.error("Больше нельзя добавлять бесплатные группы");
                                    break;
                                case 'FreeGroupsBySubscribeListIsFull':
                                    notify.error("Больше нельзя добавлять бесплатные группы");
                                    break;
                                default:
                                    notify.error("Произошла ошибка при добавлении группы");
                            }
                            $scope.ui.freeGroupLoading = false;
                            $("#confirmAddGroupToFree").modal('hide');
                            return;
                        }

                        bus.publish(events.ACCOUNT.ADD_FREE_GROUP_TO_LIST, {
                            group: res.group,
                            source: source /*free или bySubscribe*/
                        });
                        $("#confirmAddGroupToFree").modal('hide');

                    })
                    .fail(()=> {
                        notify.error("Произошла непредвиденная ошибка при добавлении группы. Просьба сообщить нам об этом");
                        $scope.ui.freeGroupLoading = false;
                        $("#confirmAddGroupToFree").modal('hide');
                    });
            }

            function calculateWallStat(data, membersCount) {
                var wall = getNulledWall();
                wall.allPostsCount = data.count;//Всего записей на стене
                wall.periodPostsCount = data.list.length;//Количество записей за период
                var ER = 0;
                data.list.forEach((post)=> {
                    var firstImage = "";
                    var firstVideo = "";
                    var firstDoc = "";
                    if (post.attachments && post.attachments.length) {
                        firstImage = post.attachments.filter((a)=> {
                            return a.type == "photo";
                        })[0];

                        firstVideo = post.attachments.filter((a)=> {
                            return a.type == "video";
                        })[0];

                        firstDoc = post.attachments.filter((a)=> {
                            return a.type == "doc" && a.doc && a.doc.ext == "gif";
                        })[0];
                    }
                    wall.list.push(angular.extend(post, {
                        firstImage: firstImage,
                        firstVideo: firstVideo,
                        firstDoc: firstDoc
                    }));

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
                    var postER = calcERByMembers(post, membersCount);
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

            function getNewsList() {
                bus.request(topics.NEWS.GET_LIST)
                    .then((newsList)=> {
                        $timeout(()=> {
                            $scope.newsList = newsList;
                            $timeout(()=> {
                                $(".nano").nanoScroller();
                            });
                        });
                    })
                    .always(()=> {
                        $(".nano").nanoScroller();
                    });
            }

            function setFilter(filter) {
                if (filter == $scope.model.filter) {
                    return;
                }

                if ($scope.ui.isLoading) {
                    notify.info("Пожалуйста, дождитесь загрузки данных.")
                    return;
                }

                $scope.model.filter = filter;
                localStorageService.set('dashboardFilter', filter);

                getMyAnalytics();
            }

            function refresh() {
                if ($scope.ui.isLoading) {
                    notify.info("Пожалуйста, дождитесь загрузки данных.")
                    return;
                }
                getMyAnalytics();
            }

            function openEditGroupsModal() {
                $("#editStatListModal").modal("show");
            }

            function saveStatList() {
                $scope.ui.editListLoading = true;

                var list = [];
                $scope.model.adminGroups.forEach((el)=> {
                    if (el.editSelected){
                        list.push(el.gid);
                    }
                });

                bus.request(topics.ACCOUNT.SAVE_STAT_LIST, {
                    list: list
                })
                    .then(()=> {
                        $timeout(()=> {
                            $scope.ui.editListLoading = false;
                            $("#editStatListModal").modal("hide");
                            memoryFactory.setMemory('dashboardData', undefined);
                            init();
                        }, 400);
                    })
                    .fail(()=> {
                        $timeout(()=> {
                            $scope.ui.editListLoading = false;
                            $("#editStatListModal").modal("hide");
                        });
                        notify.error("Произошла ошибка при сохранении списка групп. Попробуйте позже или свяжитесь с администратором в группе socstat.ru");
                    });
            }

            function goToAnalytics(gid){
                if ($scope.ui.isLoading){
                    notify.info("Пожалуйста, дождитесь загрузки всех данных");
                    return;
                }

                $state.go('index.analytics.common', {
                    gid: gid
                })
            }

        }]);