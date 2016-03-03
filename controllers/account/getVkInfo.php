<? // подключение служебной части пролога
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/prolog_before.php");
//------------------------------------------------------------------------------?>

<?
global $USER;
if (CModule::IncludeModule("iblock")) {
    $arUser = CUser::GetByID($USER->GetID())->GetNext();

    if ($arUser["UF_TOKEN_VK"])
        $auth_data = json_decode(file_get_contents("https://api.vk.com/method/users.get?user_ids=".$arUser["UF_LOGIN_VK"]."&fields=photo_200"),true);

    $data = Array(
        'isAuth' => $arUser["UF_TOKEN_VK"] ? true : false,
        'user' => Array(
            'id' => $auth_data["response"][0]["uid"],
            'firstName' => $auth_data["response"][0]["first_name"],
            'lastName' => $auth_data["response"][0]["last_name"]
        )
    );

    print_r(json_encode(Array("data" => $data)));
}
?>

<? //----------------------------------------------------------------------------
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/epilog_after.php"); ?>