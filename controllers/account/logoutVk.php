<? // подключение служебной части пролога
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/prolog_before.php");
//------------------------------------------------------------------------------?>
<?
global $user;

$user = new CUser;
$fields = Array(
    "UF_TOKEN_VK" => ""
);
$user->Update($USER->GetId(), $fields);

$data = array(
    'success' => true
);

print_r(json_encode(Array('data' => $data)));
?>

<? //----------------------------------------------------------------------------
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/epilog_after.php"); ?>