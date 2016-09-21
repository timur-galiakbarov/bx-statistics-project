<?
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/prolog_before.php");
//------------------------------------------------------------------------------?>

<?
global $USER;
if (CModule::IncludeModule("iblock")) {
    $userId = $USER->GetID();
    $arUser = CUser::GetByID($USER->GetID())->GetNext();

    $isActiveUser = true;

    if (strtotime($arUser["UF_ACTIVE_TO"]) < strtotime("now")) {
        $isActiveUser = false;
    }


    $data = Array(
        'user' => Array(
            'id' => $userId,
            'userName' => $USER->GetFirstName(),
            'userLastName' => $USER->GetLastName(),
            'userFullName' => $USER->GetFullName(),
            'email' => $USER->GetEmail(),
            'loginVk' => $arUser["UF_VK_LOGIN"],
            'tokenVk' => $arUser["UF_VK_TOKEN"],
            "tariff" => $arUser["UF_TARIFF"],
            "activeTo" => $arUser["UF_ACTIVE_TO"],
            "isActiveUser" => $isActiveUser,
            "admin" => $USER->isAdmin()
        )
    );

    print_r(json_encode(Array("data" => $data)));
}
?>

<? //----------------------------------------------------------------------------
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/epilog_after.php"); ?>