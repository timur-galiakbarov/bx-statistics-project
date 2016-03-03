<? // подключение служебной части пролога
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/prolog_before.php");
define("NEED_AUTH", false);
//------------------------------------------------------------------------------?>
<?
print_r(json_encode(Array('success' => $USER->IsAuthorized())));
?>

<? //----------------------------------------------------------------------------
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/epilog_after.php"); ?>