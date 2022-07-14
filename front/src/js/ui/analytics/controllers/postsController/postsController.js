import moment from "moment";

import events from './../../../../bl/events.js';
import topics from './../../../../bl/topics.js';
import {enums} from './../../../../bl/module.js';

angular
    .module('rad.stat')
    .controller('postsController', ['$rootScope', '$scope', '$state', 'bus', 'statPopupsFactory', 'appState', 'vkApiFactory', 'memoryFactory', '$timeout', 'radCommonFunc', '$stateParams', 'notify',
        function ($rootScope, $scope, $state, bus, statPopupsFactory, appState, vkApiFactory, memoryFactory, $timeout, radCommonFunc, $stateParams, notify) {

            var parseDate = {};

            $scope.model = {
                groups: $stateParams.list,
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
                postsFilter: "likes",
                groupsStat: [],
                showedList: [],
                wall: [],
                showedListPage: 1
            };

            $scope.ui = {
                isLoading: false,
                error: {},
                progressPercent: 0.0,
                hiddenFilter: true,
                periodFrom: "",
                periodTo: ""
            };

            $scope.nextProgressStep = nextProgressStep;
            $scope.openDatepickerPopupFrom = openDatepickerPopupFrom;
            $scope.openDatepickerPopupTo = openDatepickerPopupTo;
            $scope.getDate = getDate;
            $scope.sortPostsList = sortPostsList;
            $scope.nextPosts = nextPosts;
            $scope.getAllStat = getAllStat;
            $scope.getGroupInfoByPost = getGroupInfoByPost;

            $rootScope.setTitle("Анализ публикаций сообществ");

            $scope.$watch('ui.isLoading', (newVal)=> {
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

            function getAllStat() {

                if ($scope.ui.isLoading) {
                    return;
                }

                var deferr = $.Deferred();
                var index = 0;
                parseDate = getCheckedDate();
                $scope.ui.periodFrom = parseDate.fromLabel;
                $scope.ui.periodTo = parseDate.toLabel;
                $scope.ui.isLoading = true;
                $scope.model.groupsStat = [];
                $scope.model.showedList = [];
                $scope.model.wall = [];
                $scope.model.showedListPage = 1;

                if (!($scope.model.groups && $scope.model.groups.length)) {
                    deferr.resolve();
                    $scope.ui.isLoading = false;
                    return deferr.promise();
                }

                getCurrentStat(index);

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
                        $scope.model.groupsStat[index].wall = [];
                        $scope.model.groupsStat[index].visible = false;
                        $scope.model.groupsStat[index].groupInfo = {
                            gid: res.gid,
                            members_count: res.members_count,
                            name: res.name,
                            photo_small: res.photo_small,
                            screen_name: res.screen_name
                        };

                        angular.extend($scope.model.groups[index], res);

                        var filter = {
                            group: $scope.model.groups[index],
                            authData: authData,
                            period: parseDate
                        };

                        $.when(
                            bus.request(topics.STAT.GET_WALL, filter).then((data)=> {
                                data.list.forEach((post)=> {
                                    $scope.model.groupsStat[index].wall.push(post);
                                    $scope.model.wall.push(post);
                                });
                                $scope.model.groupsStat[index].stat = calculateWallStat(data, $scope.model.groupsStat[index].groupInfo.members_count);
                            })
                        )
                            .then(()=> {
                                $timeout(()=> {
                                    $scope.model.groupsStat[index].visible = true;
                                });

                                if (index + 1 >= $scope.model.groups.length) {
                                    $scope.ui.isLoading = false;
                                    $scope.$apply($scope.ui.isLoading);

                                    sortPostsList();
                                    deferr.resolve();
                                } else {
                                    getCurrentStat(index + 1);
                                }
                            });
                    });
                }
            }

            function init() {
                if ($scope.model.groups && $scope.model.groups.length) {
                    //Анализ несколькиз сообществ
                    getAllStat();
                } else {
                    notify.info("Нет групп для анализа, произошел переход к выбору групп.");
                    $state.go("index/posts");
                }
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

            function sortPostsList(filter) {
                if (!filter) {
                    filter = $scope.model.postsFilter;
                }
                if (filter == 'likes') {//Фильтр по лайкам
                    $scope.model.wall = _.sortBy($scope.model.wall, function (o) {
                        if (o.likes && o.likes.count)
                            return o.likes.count;
                        else
                            return 0;
                    }).reverse();
                }
                if (filter == 'reposts') {//Фильтр по лайкам
                    $scope.model.wall = _.sortBy($scope.model.wall, function (o) {
                        if (o.likes && o.reposts.count)
                            return o.reposts.count;
                        else
                            return 0;
                    }).reverse();
                }
                if (filter == 'comments') {//Фильтр по лайкам
                    $scope.model.wall = _.sortBy($scope.model.wall, function (o) {
                        if (o.likes && o.comments.count)
                            return o.comments.count;
                        else
                            return 0;
                    }).reverse();
                }

                if (filter == 'ER') {//Фильтр по ER
                    $scope.model.wall = _.sortBy($scope.model.wall, function (o) {
                        if (o.likes && o.ER)
                            return o.ER;
                        else
                            return 0;
                    }).reverse();
                }

                $scope.model.showedList = [];
                $scope.model.showedListPage = 1;

                $timeout(()=> {
                    for (var i = 0; i < 20; i++) {
                        if ($scope.model.wall[i])
                            $scope.model.showedList.push($scope.model.wall[i]);
                        else i = 20;
                    }
                });
            }

            function nextPosts() {
                if ($scope.model.showedList.length < $scope.model.wall.length) {
                    $scope.model.showedListPage++;
                    $timeout(()=> {
                        for (var i = 30 * ($scope.model.showedListPage - 1); i < 30 * $scope.model.showedListPage; i++) {
                            if ($scope.model.wall[i])
                                $scope.model.showedList.push($scope.model.wall[i]);
                            else i = 30 * $scope.model.showedListPage;
                        }
                    });
                }
            }

            function calculateWallStat(data, membersCount) {
                var wall = getNulledWall();
                wall.allPostsCount = data.count;//Всего записей на стене
                wall.periodPostsCount = data.list.length;//Количество записей за период
                var ER = 0;
                data.list.forEach(function (post) {
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

                    var postER = calcERByMembers(post, membersCount);
                    ER += parseFloat(postER);

                    if (wall.ERMax < postER) {
                        wall.ERMax = postER;
                    }
                });

                wall.averagePostsByDay = wall.dayGroups.length ? (wall.periodPostsCount / wall.dayGroups.length).toFixed(1) : 0;//В среднем постов день
                wall.ERAverage = wall.periodPostsCount ? (ER / wall.periodPostsCount).toFixed(3) : 0;//Средняя вовлеченность на пост по количеству постов
                wall.actionsCount = wall.likes.count + wall.reposts.count + wall.comments.count;//Суммарно реакций на стене
                wall.views.averageByPost = wall.periodPostsCount ? (wall.views.averageByPost / wall.periodPostsCount).toFixed(1) : 0;//В среднем просмотров на запись
                wall.actionsAverageByDay = wall.dayGroups.length ? (wall.actionsCount / wall.dayGroups.length).toFixed(1) : 0;//Среднее число реакций в день
                wall.actionsAverageByPost = wall.periodPostsCount ? (wall.actionsCount / wall.periodPostsCount).toFixed(1) : 0;//Среднее число реакций на пост

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

                if (membersCount && post.likes && post.reposts && post.comments) {
                    var postER = (post.likes.count + post.reposts.count + post.comments.count) / membersCount * 100;
                    postER = postER.toFixed(3);

                    return postER;
                }

                return (0).toFixed(3);
            }

            function getGroupInfoByPost(post) {
                console.log(post);
                var group = $scope.model.groupsStat.filter((item)=> {
                    return item.groupInfo.gid == Math.abs(post.owner_id);
                });
                if (group && group.length) {
                    return group[0].groupInfo;
                } else {
                    return "";
                }
            }

            init();


        }

    ])
;
