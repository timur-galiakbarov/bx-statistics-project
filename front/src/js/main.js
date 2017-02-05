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

/*Dashboard controller*/
import dashboardController from './ui/dashboard/controllers/dashboardController.js';

/*Account controller*/
import accountController from './ui/account/controllers/accountController.js';
import partnersController from './ui/account/controllers/partnersController.js';

/*UI------------------------------------------------------------------------------------------------------------------*/
import radAmountFilter from './ui/base/radAmountFilter.js';

/*statController------------------------------------------------------------------------------------------------------*/
import statController from './ui/stat/controllers/statController.js';
import statMainController from './ui/stat/controllers/statMainController/statMainController.js';
import statPublishAnalysisController from './ui/stat/controllers/statPublishAnalysisController/statPublishAnalysisController.js';
import findContentController from './ui/stat/controllers/findContentController/findContentController.js';
import statAuditoryCompareController from './ui/stat/controllers/statAuditoryCompareController/statAuditoryCompareController.js';
import favoritesController from './ui/favorites/controllers/favoritesController/favoritesController.js';
import findBotsController from './ui/stat/controllers/findBotsController/findBotsController.js';
import groupsAnalogController from './ui/stat/controllers/groupsAnalogController/groupsAnalogController.js';
import findAdvPostsController from './ui/stat/controllers/findAdvPostsController/findAdvPostsController.js';


import adminController from './ui/admin/controllers/adminController.js';
import vksyncController from './ui/admin/controllers/vksyncController/vksyncController.js';
import adminDashboardController from './ui/admin/controllers/adminDashboardController/adminDashboardController.js';
import crmController from './ui/admin/controllers/crmController/crmController.js';

/*statDirectives*/
import ngThumb from './ui/stat/uploader/radThumb.js';
/*statServices*/
import statPopupsFactory from './ui/stat/services/statPopupsFactory/statPopupsFactory.js';
import vkApiFactory from './ui/stat/services/vkApiFactory/vkApiFactory.js';
import memoryFactory from './ui/stat/services/memoryFactory/memoryFactory.js';
import radCommonFunc from './ui/app/factories/radCommonFunc.js';
import notify from './ui/app/factories/notify.js';
import radChooseGroup from './ui/stat/directives/radChooseGroup/radChooseGroup.js';
import radChooseGroupMain from './ui/stat/directives/radChooseGroupMain/radChooseGroupMain.js';
/*--------------------------------------------------------------------------------------------------------------------*/

//import settingsController from './ui/settings/controllers/settingsController.js';
//import radUserSettings from './ui/settings/directives/radUserSettings/radUserSettings.js';

import radMenu from './ui/menu/module.js';

import app from './app.js';

import route from './route.js';
import bus from './bl/core/bus.js';
import appState from './bl/account/appState.js';