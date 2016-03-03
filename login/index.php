<?
require($_SERVER["DOCUMENT_ROOT"]."/bitrix/header.php");
$APPLICATION->SetPageProperty("keywords", "");
$APPLICATION->SetPageProperty("description", "");
$APPLICATION->SetTitle("Авторизация");
?><div id="cl-wrapper" class="login-container">
	<div class="middle-login">
		<div class="block-flat">
			<div class="header">
				<h3 class="text-center">
				<!--<img class="logo-img" src="images/logo.png" alt="logo"/>--> </h3>
			</div>
			<div>
				 <?$APPLICATION->IncludeComponent(
	"bitrix:system.auth.form", 
	"authTpl", 
	array(
		"REGISTER_URL" => "/login/signup/",
		"FORGOT_PASSWORD_URL" => "/login/forgot-password/",
		"PROFILE_URL" => "/lk/",
		"SHOW_ERRORS" => "Y"
	),
	false
);?>
			</div>
		</div>
		<div class="text-center out-links">
            <a href="#">Забыли пароль?</a>
		</div>
	</div>
</div>
<br><?require($_SERVER["DOCUMENT_ROOT"]."/bitrix/footer.php");?>