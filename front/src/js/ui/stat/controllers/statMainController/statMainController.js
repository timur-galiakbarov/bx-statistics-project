import events from './../../../../bl/events.js';
import {enums} from './../../../../bl/module.js';

angular
    .module('rad.stat')
    .controller('statMainController', ['$rootScope', '$scope', '$state', 'bus', 'statPopupsFactory', 'appState', 'vkApiFactory',
        function ($rootScope, $scope, $state, bus, statPopupsFactory, appState, vkApiFactory) {
            $scope.currentTab = 'catalog';
            $rootScope.page.sectionTitle = 'Общая статистика сообщества';

            $scope.getStat = getStat;
            $scope.model = {
                groupAddress: ''
            };
            $scope.stat = {
                photos: {},
                videos: {}
            };
            $scope.isHiddenMenu = true;
            $scope.showGroupsMenu = showGroupsMenu;
            $scope.adminGroups = [];
            $scope.setGroupLink = setGroupLink;

            var authData = {
                token: appState.getUserVkToken(),
                login: appState.getUserVkLogin()
            };

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
                    to: moment(dateTo).format("YYYY-MM-DD"),
                    unixFrom: dateFrom / 1000,
                    unixTo: dateTo / 1000
                };
            }

            function getStat() {
                if (!$scope.model.groupAddress) {
                    return;
                }

                var parseDate = getCheckedDate();
                var vkGroupId = $scope.model.groupAddress.replace("https://vk.com/", "");
                var vkGid;
                var groupInfo;

                vkApiFactory.getGroupInfo(authData, {
                    groupId: vkGroupId
                }).then(function (res) {
                    $scope.$apply(function () {
                        $scope.stat.membersCount = res.members_count;
                        $scope.stat.groupCounters = {
                            albums: res.counters.albums || 0,
                            docs: res.counters.docs || 0,
                            photos: res.counters.photos || 0,
                            topics: res.counters.topics || 0,
                            videos: res.counters.videos || 0
                        };
                        vkGid = res.gid;
                    });
                    groupInfo = res;

                    $.when(
                        getPeopleStat(),
                        getWallStat(),
                        getAlbumsStat(),
                        getPhotoStat(),
                        getPhotoCommentsStat(),
                        getVideoStat()
                    )
                        .then(function () {
                            bus.publish(events.STAT.MAIN.FINISHED, $scope.stat);
                        });
                });

                //Получение статистики по численности
                function getPeopleStat() {
                    var deferr = $.Deferred();
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

                        deferr.resolve();

                        function getDateFromVk(dateVk) {
                            var normilizedDate = new Date(dateVk);
                            return ('0' + normilizedDate.getDate()).slice(-2) + "." + ('0' + (normilizedDate.getMonth() + 1)).slice(-2);
                        }
                    }).fail(function () {
                        deferr.reject();
                    });
                    return deferr.promise();
                }

                //Получение статистик по стене группы
                function getWallStat() {
                    var deferr = $.Deferred();
                    var iteration = 0;
                    var wallStat = {
                        activity: {
                            likesPeriodCount: 0,
                            repostsPeriodCount: 0,
                            commentsPeriodCount: 0
                        },
                        counters: {
                            wallPostsPeriodCount: 0
                        }
                    };

                    getWall();

                    function getWall() {
                        if (iteration >= 10)
                            return;

                        vkApiFactory.getWall(authData, {
                            groupId: vkGid,
                            offset: iteration * 100,
                            count: 100
                        }).then(function (res) {
                            var flagStop = false;
                            if (!res || res.error && res.error && res.error.error_code == 6) {
                                setTimeout(function () {
                                    getWall();
                                }, 400);
                                return;
                            }

                            if (res && res.length > 0) {
                                wallStat.counters.allWallPostsCount = res[0];//Количество постов за период

                                res.forEach(function (post) {
                                    if (post.date > parseDate.unixFrom && post.date < parseDate.unixTo) {
                                        wallStat.counters.wallPostsPeriodCount++;//Количество постов за период
                                        wallStat.activity.likesPeriodCount += post.likes.count || 0;
                                        wallStat.activity.repostsPeriodCount += post.reposts.count || 0;
                                        wallStat.activity.commentsPeriodCount += post.comments.count || 0;
                                    } else if (post.date <= parseDate.unixFrom && !post.is_pinned) {
                                        flagStop = true;
                                    }
                                });
                            } else {
                                flagStop = true;
                            }

                            if (!flagStop) {
                                iteration++;
                                getWall();
                            } else {
                                console.log(wallStat);
                                $scope.$apply(function () {
                                    $scope.stat.wall = {
                                        allPosts: wallStat.counters.allWallPostsCount,
                                        postsPeriod: wallStat.counters.wallPostsPeriodCount,
                                        likesPeriod: wallStat.activity.likesPeriodCount,
                                        repostsPeriod: wallStat.activity.repostsPeriodCount,
                                        commentsPeriod: wallStat.activity.commentsPeriodCount
                                    };
                                });
                                deferr.resolve();
                            }
                        }).fail(function () {
                            deferr.reject();
                        });
                    }
                    return deferr.promise();
                }

                function getAlbumsStat() {
                    var deferr = $.Deferred();
                    var maxIterations = 5,
                        iteration = 0,
                        newAlbums = 0;

                    getAlbums();

                    function getAlbums() {
                        if (iteration >= maxIterations) {
                            newAlbums = 0;
                            return;
                        }
                        iteration++;
                        vkApiFactory.getAlbums(authData, {
                            groupId: "-" + vkGid
                        }).then(function (res) {
                            if (!res || res.error && res.error && res.error.error_code == 6) {
                                setTimeout(function () {
                                    getAlbums();
                                }, 400);
                                return;
                            }
                            if (res && res.length > 0) {
                                res.forEach(function (item) {
                                    if (item.created > parseDate.unixFrom && item.created < parseDate.unixTo) {
                                        newAlbums++;
                                    }
                                });
                                $scope.$apply(function () {
                                    $scope.stat.albums = {
                                        albumsPeriod: newAlbums
                                    };
                                });
                                deferr.resolve();
                            }
                        }).fail(function () {
                            deferr.reject();
                        });
                    }
                    return deferr.promise();
                }

                function getPhotoStat() {
                    var deferr = $.Deferred();
                    var maxIterations = 30,
                        iteration = 0,
                        photosStat = {
                            allCount: 0,
                            photoPeriodCount: 0,
                            repostsPeriodCount: 0,
                            likesPeriodCount: 0
                        },
                        flagStop = false;

                    getPhotos();

                    function getPhotos() {
                        if (iteration >= maxIterations) {
                            //newAlbums = 0;
                            return;
                        }
                        vkApiFactory.getAllPhoto(authData, {
                            groupId: "-" + vkGid,
                            count: 200,
                            offset: iteration * 200,
                            extended: 1
                        }).then(function (res) {
                            console.log(res);
                            if (!res || res.error && res.error && res.error.error_code == 6) {
                                setTimeout(function () {
                                    getPhotos();
                                }, 400);
                                return;
                            }
                            if (res && res.length > 0) {
                                photosStat.allCount = res[0];//Количество постов за период
                                if (res.length <= photosStat.allCount) {
                                    flagStop = true;
                                }

                                res.forEach(function (photo) {
                                    if (photo.created > parseDate.unixFrom && photo.created < parseDate.unixTo) {
                                        photosStat.photoPeriodCount++;//Количество фото за период
                                        photosStat.likesPeriodCount += photo.likes.count || 0;//Количество фото за период
                                        photosStat.repostsPeriodCount += photo.reposts.count || 0;
                                    } else if (photo.date <= parseDate.unixFrom) {
                                        flagStop = true;
                                    }
                                });
                            } else {
                                flagStop = true;
                            }

                            if (!flagStop) {
                                iteration++;
                                getPhotos();
                            } else {
                                $scope.$apply(function () {
                                    $scope.stat.photos.allCount = photosStat.allCount;
                                    $scope.stat.photos.likesPeriodCount = photosStat.likesPeriodCount;
                                    $scope.stat.photos.repostsPeriodCount = photosStat.repostsPeriodCount;
                                    $scope.stat.photos.photoPeriodCount = photosStat.photoPeriodCount;
                                });
                                deferr.resolve();
                            }
                        }).fail(function () {
                            deferr.reject();
                        });

                    }
                    return deferr.promise();
                }

                function getPhotoCommentsStat() {
                    var deferr = $.Deferred();
                    var maxIterations = 30,
                        iteration = 0,
                        photosStat = {
                            commentsPeriodCount: 0
                        },
                        flagStop = false;

                    getPhotosComments();

                    function getPhotosComments() {
                        if (iteration >= maxIterations) {
                            //newAlbums = 0;
                            return;
                        }
                        vkApiFactory.getAllCommentsPhoto(authData, {
                            groupId: "-" + vkGid,
                            count: 100,
                            offset: iteration * 100
                        }).then(function (res) {
                            console.log(res);
                            if (!res || res.error && res.error && res.error.error_code == 6) {
                                setTimeout(function () {
                                    getPhotosComments();
                                }, 400);
                                return;
                            }
                            if (res && res.length > 0) {
                                res.forEach(function (comment) {
                                    if (comment.date > parseDate.unixFrom && comment.date < parseDate.unixTo) {
                                        photosStat.commentsPeriodCount++;//Количество комментариев за период
                                    } else if (comment.date <= parseDate.unixFrom) {
                                        flagStop = true;
                                    }
                                });
                            } else {
                                flagStop = true;
                            }

                            if (!flagStop) {
                                iteration++;
                                getPhotosComments();
                            } else {
                                $scope.$apply(function () {
                                    $scope.stat.photos.commentsPeriodCount = photosStat.commentsPeriodCount
                                });
                                deferr.resolve();
                            }
                        }).fail(function () {
                            deferr.reject();
                        });

                    }
                    return deferr.promise();
                }

                function getVideoStat() {
                    var deferr = $.Deferred();
                    var maxIterations = 30,
                        iteration = 0,
                        videoStat = {
                            allCount: 0,
                            videoPeriodCount: 0,
                            repostsPeriodCount: 0,
                            likesPeriodCount: 0
                        },
                        flagStop = false;

                    getVideo();

                    function getVideo() {
                        if (iteration >= maxIterations) {
                            //newAlbums = 0;
                            return;
                        }
                        vkApiFactory.getVideos(authData, {
                            groupId: "-" + vkGid,
                            count: 200,
                            offset: iteration * 200,
                            extended: 1
                        }).then(function (res) {
                            console.log(res);
                            if (!res || res.error && res.error && res.error.error_code == 6) {
                                setTimeout(function () {
                                    getVideo();
                                }, 400);
                                return;
                            }
                            if (res && res.length > 0) {
                                videoStat.allCount = res[0];//Количество постов за период
                                if (res.length <= videoStat.allCount) {
                                    flagStop = true;
                                }

                                res.forEach(function (video) {
                                    if (video.date > parseDate.unixFrom && video.date < parseDate.unixTo) {
                                        videoStat.photoPeriodCount++;//Количество фото за период
                                        videoStat.likesPeriodCount += video.likes.count || 0;//Количество фото за период
                                        videoStat.repostsPeriodCount += video.reposts.count || 0;
                                    } else if (video.date <= parseDate.unixFrom) {
                                        flagStop = true;
                                    }
                                });
                            } else {
                                flagStop = true;
                            }

                            if (!flagStop) {
                                iteration++;
                                getVideo();
                            } else {
                                $scope.$apply(function () {
                                    $scope.stat.videos.allCount = videoStat.allCount;
                                    $scope.stat.videos.likesPeriodCount = videoStat.likesPeriodCount;
                                    $scope.stat.videos.repostsPeriodCount = videoStat.repostsPeriodCount;
                                    $scope.stat.videos.videoPeriodCount = videoStat.videoPeriodCount;
                                });
                                deferr.resolve();
                            }
                        }).fail(function () {
                            deferr.reject();
                        });

                    }
                    return deferr.promise();
                }
            }

            function getAdminGroups() {
                vkApiFactory.getUserGroups(authData, {
                    extended: 1,
                    filter: "moder",
                    count: 1000,
                    fields: ""
                }).then(function (res) {
                    console.log(res);
                    if (res && res[0] > 0) {
                        res = res.slice(1);
                        $scope.adminGroups = res;
                    }
                });
            }

            function showGroupsMenu() {
                $scope.isHiddenMenu = !$scope.isHiddenMenu;
            }

            function setGroupLink(group) {
                $scope.model.groupAddress = "https://vk.com/" + group.screen_name;
                $scope.isHiddenMenu = true;
            }

            function checkMainStatIsSaved() {
                var stat = appState.getMainStat();
                if (stat) {
                    $scope.stat = stat;
                }
            }

            getAdminGroups();
            checkMainStatIsSaved();

            $('.icheck').iCheck({
                checkboxClass: 'icheckbox_flat-blue',
                radioClass: 'iradio_flat-blue'
            });

        }]);