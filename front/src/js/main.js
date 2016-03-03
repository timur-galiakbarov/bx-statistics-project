import accountLogic from './bl/account/accountLogic.js';
import shopLogic from './bl/shop/shopLogic.js';

import modules from './ui/module.js';

import radForm from './ui/base/radForm.js';
import radValidate from './ui/base/radValidate.js';
import radValidationMessage from './ui/base/radValidationMessage.js';
import radLoader from './ui/base/radLoader.js';
import radOnFinishRenderNgRepeat from './ui/base/radOnFinishRenderNgRepeat.js';

import dashboardController from './ui/dashboard/controllers/dashboardController.js';

/*UI------------------------------------------------------------------------------------------------------------------*/
import radAmountFilter from './ui/base/radAmountFilter.js';

/*shopController------------------------------------------------------------------------------------------------------*/
import shopController from './ui/shop/controllers/shopController.js';
/*shopDirectives*/
import radCatalogItems from './ui/shop/directives/radCatalogItems/radCatalogItems.js';
import ngThumb from './ui/shop/uploader/radThumb.js';
/*shopServices*/
import shopPopupsFactory from './ui/shop/services/shopPopupsFactory/shopPopupsFactory.js';
/*--------------------------------------------------------------------------------------------------------------------*/

import ordersController from './ui/orders/controllers/ordersController.js';

import settingsController from './ui/settings/controllers/settingsController.js';
import radVkAuth from './ui/settings/directives/radVkAuth/radVkAuth.js';
import radUserSettings from './ui/settings/directives/radUserSettings/radUserSettings.js';

import radMenu from './ui/menu/module.js';

import app from './app.js';

import route from './route.js';
import bus from './bl/core/bus.js';
import appState from './bl/account/appState.js';