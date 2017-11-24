import events from './../../../../bl/events.js';
import topics from './../../../../bl/topics.js';
import {enums} from './../../../../bl/module.js';

angular
    .module('rad.stat')
    .controller('compareController', ['$rootScope', '$scope', '$state', 'bus', 'statPopupsFactory', 'appState', 'vkApiFactory', 'memoryFactory', '$timeout', 'radCommonFunc', '$stateParams', 'notify',
        function ($rootScope, $scope, $state, bus, statPopupsFactory, appState, vkApiFactory, memoryFactory, $timeout, radCommonFunc, $stateParams, notify) {

            var parseDate = {};

            $scope.model = {
                groups: $stateParams.list,
                groupsStat: [],
                datePicker: {
                    dateFrom: '',
                    dateTo: '',
                    popupFrom: {
                        opened: false
                    },
                    popupTo: {
                        opened: false
                    }
                }
            };

            $scope.ui = {
                isLoading: false,
                error: {},
                progressPercent: 0.0,
                activeTab: '',
                hiddenFilter: true,
                periodFrom: "",
                periodTo: ""
            };

            $scope.nextProgressStep = nextProgressStep;
            $scope.openDatepickerPopupFrom = openDatepickerPopupFrom;
            $scope.openDatepickerPopupTo = openDatepickerPopupTo;
            $scope.getDate = getDate;
            $scope.getAllStat = getAllStat;

            $rootScope.setTitle("Сравнение сообществ");

            $scope.$watch('ui.isLoading', (newVal)=> {
                $rootScope.globalLoading = newVal;
            });

            $scope.$watch('model.datePicker.dateFrom', (newVal, oldVal)=> {
                if (newVal != oldVal) {
                    $scope.ui.error.datePickerFromError = "";
                    var radios = $('input[name=checkDate]');
                    radios.filter('[value=datePicker]').prop("checked", true);
                }
            });

            $scope.$watch('model.datePicker.dateTo', (newVal, oldVal)=> {
                if (newVal != oldVal) {
                    $scope.ui.error.datePickerToError = "";
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
                            $scope.ui.error.datePickerFromError = "Неверная дата";
                            return {
                                error: true
                            }
                        }
                        if (!$scope.model.datePicker.dateTo) {
                            $scope.ui.error.datePickerToError = "Неверная дата";
                            return {
                                error: true
                            }
                        }
                        if ($scope.model.datePicker.dateFrom > $scope.model.datePicker.dateTo) {
                            $scope.ui.error.datePickerFromError = "Дата начала превышает дату окончания";
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

                if ($scope.ui.isLoading){
                    return;
                }

                var deferr = $.Deferred();
                var index = 0;
                parseDate = getCheckedDate();
                $scope.ui.periodFrom = parseDate.fromLabel;
                $scope.ui.periodTo = parseDate.toLabel;
                $scope.ui.isLoading = true;
                $scope.model.groupsStat = [];

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

                        console.log(filter);

                        $.when(
                            bus.request(topics.STAT.GET_WALL, filter).then((data)=> {
                                console.log(data);
                                $scope.model.groupsStat[index].wall = calculateWallStat(data, $scope.model.groupsStat[index].groupInfo.members_count);
                                $scope.$apply($scope.model.groupsStat[index].wall);
                            }),
                            bus.request(topics.STAT.GET_GROUP_STAT, filter).then((data)=> {
                                $scope.model.groupsStat[index].groupStat = data;
                                $scope.$apply($scope.model.groupsStat[index].groupStat);
                            }),
                            bus.request(topics.STAT.GET_PHOTO, filter).then((data)=> {
                                $scope.model.groupsStat[index].photo = calculatePhotoStat(data);
                                $scope.$apply($scope.model.groupsStat[index].photo);
                            }),
                            bus.request(topics.STAT.GET_PHOTO_COMMENTS, filter).then((data)=> {
                                $scope.model.groupsStat[index].photoComments = data;
                            }),
                            bus.request(topics.STAT.GET_VIDEO, filter).then((data)=> {
                                $scope.model.groupsStat[index].video = calculateVideoStat(data);
                                $scope.$apply($scope.model.groupsStat[index].video);
                            })
                        )
                            .then(()=> {

                                $scope.model.groupsStat[index].visible = true;
                                $scope.$apply($scope.model.groupsStat[index].visible);

                                if (index + 1 >= $scope.model.groups.length) {
                                    $scope.ui.isLoading = false;
                                    $scope.$apply($scope.ui.isLoading);
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
                    notify.info("Нет групп для сравнения, произошел переход к выбору групп.");
                    $state.go("index.compare");
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

            function calculateWallStat(data, membersCount) {
                var wall = getNulledWall();
                wall.allPostsCount = data.count;//Всего записей на стене
                wall.periodPostsCount = data.list.length;//Количество записей за период
                var ER = 0;
                data.list.forEach((post)=>{
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

            function getNulledPhoto() {
                return {
                    allCount: 0,
                    photoPeriodCount: 0,
                    likesPeriodCount: 0,
                    repostsPeriodCount: 0
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

            function getNulledVideo() {
                return {
                    allCount: 0,
                    videoPeriodCount: 0,
                    likesPeriodCount: 0,
                    repostsPeriodCount: 0
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

            init();


        }

    ])
;