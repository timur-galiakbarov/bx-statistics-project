import events from './../../../../bl/events.js';
import topics from './../../../../bl/topics.js';
import {enums} from './../../../../bl/module.js';
import co from 'co';

angular
	.module('rad.stat')
	.directive('pAuditoryCompare', pAuditoryCompare);

pAuditoryCompare.$inject = ['$state', 'bus', 'notify', 'appState', 'radCommonFunc', 'vkApiFactory', 'memoryFactory', '$timeout'];

function pAuditoryCompare($state, bus, notify, appState, radCommonFunc, vkApiFactory, memoryFactory, $timeout) {
	return {
		restrict: 'EA',
		templateUrl: 'js/ui/analytics/directives/pAuditoryCompare/pAuditoryCompare.html',
		controller: ['$scope', '$state', function ($scope, $state) {

		}],
		scope: {},
		link: function ($scope) {

			var authData = {
				token: appState.getUserVkToken(),
				login: appState.getUserVkLogin()
			};

			$scope.model = {
				groupListShowed: false,
				groupsFirst: '',
				groupIntersectionCount: 2,
				progressPercent: 0
			};

			$scope.toggleShowGroups = function () {
				$scope.model.groupListShowed = !$scope.model.groupListShowed;
			};

			$scope.addGroup = function (group) {
				var first = $scope.model.groupsFirst ? '\n' : '';
				$scope.model.groupsFirst += `${first}https://vk.com/${group.screen_name}\n`;
				$scope.model.groupsFirst = $scope.model.groupsFirst.replace(/\n\n+/g, '\n');
			};

			$scope.findCompares = function () {
				return co(function*(){
					$scope.model.groupListShowed = false;

					if (!appState.isActiveUser()) {
						bus.publish(events.ACCOUNT.SHOW_PERIOD_FINISHED_MODAL);
						return;
					}

					$scope.model.groups = $scope.model.groupsFirst.split("\n");
					$scope.model.groups = $scope.model.groups.filter(i=>i);
					$scope.model.groups = $scope.model.groups.map((i)=> {
						return radCommonFunc.getGroupId(i);
					});
					$scope.model.groups = _.uniq($scope.model.groups);
					$scope.model.groups = $scope.model.groups.map((i)=> {
						return {
							groupId: i,
							defer: $.Deferred(),
							members: []
						}
					});

					if (!($scope.model.groups && $scope.model.groups.length)) {
						notify.error("Нет групп для сравнения")
						return;
					}

					$scope.model.groups.forEach(function*(group) {
						const request = group.groupRequest = yield vkApiFactory.getGroupInfo(authData, {
							groupId: group.groupId
						});

						if (request && request.error && request.error.error_code == 100) {
							group.urlError = 'Введеная группа вконтакте не найдена';
						}

						group.info = {
							gid: request.gid,
							count: request.members_count,
							name: request.name,
							photoUrl: request.photo_big
						};

						function getMembers(groupId, iteration, progress) {
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
									$scope.model.progressPercent = (100 / group.info.count) * (iteration * 25000)
									$scope.$apply(()=> {
										$scope.model.progressPercent = $scope.model.progressPercent.toFixed(2);
									});
								}

								if (res && !res.error) {
									res.forEach((item)=> {
										if (item.items && item.items.length)
											Array.prototype.push.apply(group.members, item.items);
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
				});






				$scope.model.groups.forEach((group)=> {
					group.groupRequest = vkApiFactory.getGroupInfo(authData, {
						groupId: group.groupId
					}).then(function (res) {
						if (res && res.error && res.error.error_code == 100) {
							group.urlError = 'Введеная группа вконтакте не найдена';
						}

						group.info = {
							gid: res.gid,
							count: res.members_count,
							name: res.name,
							photoUrl: res.photo_big
						}
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
								$scope.model.progressPercent = (100 / group.info.count) * (iteration * 25000)
								$scope.$apply(()=> {
									$scope.model.progressPercent = $scope.model.progressPercent.toFixed(2);
								});
							}

							if (res && !res.error) {
								res.forEach((item)=> {
									if (item.items && item.items.length)
										Array.prototype.push.apply(group.members, item.items);
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

				$timeout(()=> {
					$scope.model.progressPercent = 0;
					$scope.model.groupIsFinded = false;
				});

				$scope.model.intersectionList = [];
				$scope.model.intersectionListView = [];
				$scope.model.dataIsLoaded = false;


				$.when.apply($, $scope.model.groups.map(i=>i.groupRequest))
					.then(()=> {
						var groupsWithError = $scope.model.groups.filter(i=>i.urlError);
						if (groupsWithError.length > 0) {
							notify.error(`Группа ${groupsWithError[0].groupId} не найдена ВКонтакте. Исправьте ошибку`)
							return;
						}

						$scope.$apply(()=> {
							$scope.model.isLoading = true;
							$scope.model.groupIsFinded = true;
						});

						var max = _.maxBy($scope.model.groups, function (group) {
							return group.info.count;
						});
						$scope.model.groups.forEach((group)=> {
							if (group.info.count == max.info.count) {
								group.isMax = true;
							}
						});

						$.when.apply($, $scope.model.groups.map(i=>i.getMembers(i.info.gid, 0, i.isMax)))
							.then(()=> {
								//Сравнение массивов
								$scope.$apply(()=> {
									var intersection = [];
									var pairs = [];
									var pairIndex = 0;
									for (var i = 0; i < $scope.model.groups.length; i++) {
										var k = 0;
										for (var j = i + k; j < $scope.model.groups.length; j++) {
											if (!pairs[pairIndex]) {
												pairs[pairIndex] = [];
											}
											pairs[pairIndex].push($scope.model.groups[i].members);
											if (k < $scope.model.groupIntersectionCount) {
												if (!pairs[i]) {
													pairs[i] = [];
												}
												pairs[i].push($scope.model.groups[i].members);
											}
											k++;
										}

									}
									/*for (var i = 0; i < $scope.model.groups.length; i++) {
									 var k = 0;
									 pairs[i] = [$scope.model.groups[i].members];
									 for (var j = 0; j < $scope.model.groups.length; j++) {
									 if (i == j) {
									 return;
									 }
									 if (k < $scope.model.groupIntersectionCount)
									 pairs[i].push($scope.model.groups[j].members);
									 k++;
									 }
									 }*/
									console.log(pairs);

									pairs.forEach((pair)=> {
										var tempIntersections = _.intersection(...pair);
										tempIntersections.forEach((item)=> {
											intersection.push(item);
										});
									});
									intersection = _.uniq(intersection);
									$scope.model.intersection = intersection;

									/*$scope.model.groups.forEach((group)=> {//Это уже не нужно
									 group.intersectionPercent = ((intersection.length / group.info.count) * 100).toFixed(2);
									 });*/

									$scope.model.intersectionList = intersection;

									$timeout(()=> {
										if (intersection.length < 50000)
											$scope.model.intersectionListView = intersection.join("\n");
										else
											$scope.model.intersectionListView = [];

										$scope.model.dataIsLoaded = true;
										$scope.model.isLoading = false;
										memoryFactory.setMemory('auditoryCompare', $scope.model);
									});
								});
							})
							.always(()=> {
								$scope.$apply(()=> {
									$scope.model.dataIsLoaded = true;
								});
							});
					});

			};

			$scope.getReport = function () {
				var date = new Date();
				var dateCreate = date.getDate() + "." + date.getMonth() + "." + date.getFullYear() + "_" + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();

				bus.request(topics.REPORTS.GET_COMPARE_LIST_TXT, {
					data: $scope.model.intersection.join(","),
					dateCreate: dateCreate
				}).then((result)=> {
					notify.success("Отчет сформирован. Убедитесь, что для сайта socstat.ru разрешены всплывающие окна.");
					window.location.href = result.filename;
				})
					.fail(()=> {
						notify.error("Произошла ошибка при формировании отчета. Пожалуйста, сообщите об этом в нашу группу ВКонтакте");
					});

			};

		}
	};
}