import accountLogic from './bl/account/accountLogic.js';
import statLogic from './bl/stat/statLogic.js';

import modules from './ui/module.js';

import radForm from './ui/base/radForm.js';
import radValidate from './ui/base/radValidate.js';
import radValidationMessage from './ui/base/radValidationMessage.js';
import radLoader from './ui/base/radLoader.js';
import radOnFinishRenderNgRepeat from './ui/base/radOnFinishRenderNgRepeat.js';
import vkGroupWidget from './ui/app/directives/vkGroupWidget/vkGroupWidget.js';
import radTariff from './ui/app/directives/radTariff/radTariff.js';
import radAdminLink from './ui/app/directives/radAdminLink/radAdminLink.js';
import vkApiFactory from './ui/app/factories/vkApi/vkApiFactory.js';
import vkApiMapper from './ui/app/factories/vkApi/vkApiMapper.js';

/*Analytics controller*/
import analyticsDashboardController from './ui/analytics/controllers/analyticsDashboardController.js';
import dashboardController from './ui/dashboard/controllers/dashboardController.js';
import compareDashboardController from './ui/analytics/controllers/compareDashboardController/compareDashboardController.js';
import commonAnalyticsController from './ui/analytics/controllers/commonAnalytics/commonAnalyticsController.js';
import compareController from './ui/analytics/controllers/compareController/compareController.js';
import postsDashboardController from './ui/analytics/controllers/postsDashboardController/postsDashboardController.js';
import postsController from './ui/analytics/controllers/postsController/postsController.js';
import './ui/analytics/controllers/parsersController/parsersController.js';

/*Analytics directives*/
import postDefault from './ui/analytics/directives/postDefault/postDefault.js';
import './ui/analytics/directives/pAuditoryCompare/pAuditoryCompare.js';
import './ui/analytics/directives/radChooseGroup/radChooseGroup.js';
/*Account controller*/
import accountController from './ui/account/controllers/accountController.js';

/*UI------------------------------------------------------------------------------------------------------------------*/
import radAmountFilter from './ui/base/radAmountFilter.js';
import radNumberFormatter from './ui/base/radNumberFormatter.js';
import radNumbersOnly from './ui/base/radNumbersOnly.js';
import radTooltip from './ui/base/radTooltip.js';

/*statController------------------------------------------------------------------------------------------------------*/
/*import statController from './ui/stat/controllers/statController.js';
import statMainController from './ui/stat/controllers/statMainController/statMainController.js';
import statPublishAnalysisController from './ui/stat/controllers/statPublishAnalysisController/statPublishAnalysisController.js';
import findContentController from './ui/stat/controllers/findContentController/findContentController.js';
import statAuditoryCompareController from './ui/stat/controllers/statAuditoryCompareController/statAuditoryCompareController.js';
import favoritesController from './ui/favorites/controllers/favoritesController/favoritesController.js';
import findBotsController from './ui/stat/controllers/findBotsController/findBotsController.js';
import groupsAnalogController from './ui/stat/controllers/groupsAnalogController/groupsAnalogController.js';
import findAdvPostsController from './ui/stat/controllers/findAdvPostsController/findAdvPostsController.js';
import findActiveUsersController from './ui/stat/controllers/findActiveUsersController/findActiveUsersController.js';*/


import adminController from './ui/admin/controllers/adminController.js';
import vksyncController from './ui/admin/controllers/vksyncController/vksyncController.js';
import adminDashboardController from './ui/admin/controllers/adminDashboardController/adminDashboardController.js';
import crmController from './ui/admin/controllers/crmController/crmController.js';

/*statDirectives*/
import ngThumb from './ui/stat/uploader/radThumb.js';
/*statServices*/
import statPopupsFactory from './ui/stat/services/statPopupsFactory/statPopupsFactory.js';
import permissionService from './ui/account/services/permissionService.js';
import memoryFactory from './ui/stat/services/memoryFactory/memoryFactory.js';
import radCommonFunc from './ui/app/factories/radCommonFunc.js';
import notify from './ui/app/factories/notify.js';
import radChooseGroupMain from './ui/stat/directives/radChooseGroupMain/radChooseGroupMain.js';
/*--------------------------------------------------------------------------------------------------------------------*/

//import settingsController from './ui/settings/controllers/settingsController.js';
//import radUserSettings from './ui/settings/directives/radUserSettings/radUserSettings.js';

import radMenu from './ui/menu/module.js';

import app from './app.js';

import route from './route.js';
import bus from './bl/core/bus.js';
import appState from './bl/account/appState.js';