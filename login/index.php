<?
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/header.php");
$APPLICATION->SetPageProperty("keywords", "");
$APPLICATION->SetPageProperty("description", "");
$APPLICATION->SetTitle("Авторизация");

global $USER;
//$redirectUrl = "http://localhost:6450";
$redirectUrl = "http://localhost:6449";
//$redirectUrl = "http://socstat.ru";
if ($USER->IsAuthorized())
    header("location: /lk");
?>
    <div id="cl-wrapper" class="login-container">
        <div class="middle-login">
            <div class="block-flat">
                <div class="header">
                    <h3 class="text-center logo-title">
                        <img src="/bitrix/templates/.default/images/logoIcon.png" alt="socstat.ru"/>
                        socstat.ru
                    </h3>
                </div>
                <div>
                    <div class="content">
                        <h4 class="title text-center">Вход в систему</h4>

                        <div class="form-group">
                            <div class="col-sm-12">
                                <div class="vk-auth-icon text-center">
                                    <a href="https://oauth.vk.com/authorize?client_id=5358505&scope=wall,photos,stats,friends,groups,video,notifications&redirect_uri=<?=$redirectUrl;?>/login/getCode.php?site=auth&response_type=token">
                                        <img src="<?= SITE_TEMPLATE_PATH ?>/images/vk64.png">
                                        <span>Войти через VK</span>
                                    </a>
                                </div>
                            </div>
                        </div>

                    </div>

                    <? /*$APPLICATION->IncludeComponent(
					"bitrix:system.auth.form",
					"authTpl",
					array(
						"REGISTER_URL" => "/login/signup/",
						"FORGOT_PASSWORD_URL" => "/login/forgot-password/",
						"PROFILE_URL" => "/lk/",
						"SHOW_ERRORS" => "Y"
					),
					false
				);*/ ?>
                </div>
            </div>
            <!--<div class="text-center out-links">
                <a href="#">Забыли пароль?</a>
            </div>-->
        </div>
    </div>
    <br><? require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/footer.php"); ?>