angular.module('app').config(['$stateProvider', '$urlRouterProvider',
    function ($stateProvider, $urlRouterProvider) {
        $urlRouterProvider.otherwise("/dashboard/");
        //$urlRouterProvider.when('page-detail', '/contacts/:pageCode');
        $stateProvider
            .state('index', {
                url: '/',
                templateUrl: './templates/template/app/template.html',
                controller: 'appController'
            })
            //Dashboard-------------------------------------------------------------------------------------------------
            .state('index.dashboard', {
                url: 'dashboard/',
                views: {
                    'content': {
                        templateUrl: './templates/js/ui/dashboard/controllers/dashboardController.html',
                        controller: 'dashboardController'
                    }
                },
                parent: 'index'
            })
            //Статистика сообществ--------------------------------------------------------------------------------------
            //Статистика - Список
            .state('index.analytics', {
                url: 'analytics/',
                views: {
                    'content': {
                        templateUrl: './templates/js/ui/analytics/controllers/analyticsDashboardController.html',
                        controller: 'analyticsDashboardController'
                    }
                },
                parent: 'index'
            })
            //Статистика - детальная страница
            .state('index.analytics.common', {
                url: 'analytics/group/:gid',
                views: {
                    'content': {
                        templateUrl: './templates/js/ui/analytics/controllers/commonAnalytics/commonAnalyticsController.html',
                        controller: 'commonAnalyticsController'
                    }
                },
                parent: 'index'
            })
            //Сравнение сообществ---------------------------------------------------------------------------------------
            //Сравнение сообществ - Список
            .state('index.compare', {
                url: 'compare/',
                views: {
                    'content': {
                        templateUrl: './templates/js/ui/analytics/controllers/compareDashboardController/compareDashboardController.html',
                        controller: 'compareDashboardController'
                    }
                },
                parent: 'index'
            })
            //Сравнение сообществ - таблица
            .state('index.compare.detail', {
                url: 'compare/detail',
                views: {
                    'content': {
                        templateUrl: './templates/js/ui/analytics/controllers/compareController/compareController.html',
                        controller: 'compareController'
                    }
                },
                params: {
                    list: ""
                },
                parent: 'index'
            })
            //Анализ публикаций
            .state('index.posts', {
                url: 'posts/',
                views: {
                    'content': {
                        templateUrl: './templates/js/ui/analytics/controllers/postsDashboardController/postsDashboardController.html',
                        controller: 'postsDashboardController'
                    }
                },
                parent: 'index'
            })
            .state('index.posts.detail', {
                url: 'posts/detail',
                views: {
                    'content': {
                        templateUrl: './templates/js/ui/analytics/controllers/postsController/postsController.html',
                        controller: 'postsController'
                    }
                },
                params: {
                    list: ""
                },
                parent: 'index'
            })
            //Оплата----------------------------------------------------------------------------------------------------
            .state('index.account', {
                url: 'account/',
                views: {
                    'content': {
                        url: 'account/',
                        templateUrl: './templates/js/ui/account/controllers/accountController.html',
                        controller: 'accountController'
                    }
                },
                parent: 'index'
            })

            /*.state('index.publishFavorites', {
                url: 'publishAnalysis/favorites',
                views: {
                    'content': {
                        templateUrl: './templates/js/ui/favorites/controllers/favoritesController/favoritesController.html',
                        controller: 'favoritesController'
                    }
                },
                parent: 'index'
            })*/
            //----------------------------------------------------------------------------------------------------------
            .state('index.admin', {
                url: 'admin/',
                views: {
                    'content': {
                        url: 'admin',
                        templateUrl: './templates/js/ui/admin/controllers/adminController.html',
                        controller: 'adminController'
                    }
                },
                parent: 'index'
            })
            .state('index.admin.vksync', {
                url: 'vksync/',
                views: {
                    'admin': {
                        url: 'vksync',
                        templateUrl: './templates/js/ui/admin/controllers/vksyncController/vksyncController.html',
                        controller: 'vksyncController'
                    }
                },
                parent: 'index.admin'
            })
            .state('index.admin.crm', {
                url: 'crm/',
                views: {
                    'admin': {
                        url: 'crm',
                        templateUrl: './templates/js/ui/admin/controllers/crmController/crmController.html',
                        controller: 'crmController'
                    }
                },
                parent: 'index.admin'
            })
            .state('index.admin.dashboard', {
                url: 'dashboard/',
                views: {
                    'admin': {
                        url: 'dashboard',
                        templateUrl: './templates/js/ui/admin/controllers/adminDashboardController/adminDashboardController.html',
                        controller: 'adminDashboardController'
                    }
                },
                parent: 'index.admin'
            });

        //$locationProvider.html5Mode(true);
    }]);