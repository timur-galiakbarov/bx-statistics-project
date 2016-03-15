import accountLogic from './bl/account/accountLogic.js';
import statLogic from './bl/stat/statLogic.js';

import modules from './ui/module.js';

import radForm from './ui/base/radForm.js';
import radValidate from './ui/base/radValidate.js';
import radValidationMessage from './ui/base/radValidationMessage.js';
import radLoader from './ui/base/radLoader.js';
import radOnFinishRenderNgRepeat from './ui/base/radOnFinishRenderNgRepeat.js';

/*Dashboard controller*/
import dashboardController from './ui/dashboard/controllers/dashboardController.js';
import radVkAuth from './ui/dashboard/directives/radVkAuth/radVkAuth.js';
/*UI------------------------------------------------------------------------------------------------------------------*/
import radAmountFilter from './ui/base/radAmountFilter.js';

/*statController------------------------------------------------------------------------------------------------------*/
import statController from './ui/stat/controllers/statController.js';
/*statDirectives*/
import ngThumb from './ui/stat/uploader/radThumb.js';
/*statServices*/
import statPopupsFactory from './ui/stat/services/statPopupsFactory/statPopupsFactory.js';
/*--------------------------------------------------------------------------------------------------------------------*/

import settingsController from './ui/settings/controllers/settingsController.js';
import radUserSettings from './ui/settings/directives/radUserSettings/radUserSettings.js';

import radMenu from './ui/menu/module.js';

import app from './app.js';
import radVkFactory from './ui/app/factories/radVkFactory.js';

import route from './route.js';
import bus from './bl/core/bus.js';
import appState from './bl/account/appState.js';