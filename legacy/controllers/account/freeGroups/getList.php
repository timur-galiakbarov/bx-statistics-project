<?
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/prolog_before.php");
//------------------------------------------------------------------------------?>

<?
if (CModule::IncludeModule("iblock")) {
    $arSelect = Array("ID", "NAME", "PREVIEW_TEXT", "ACTIVE_FROM", "PROPERTY_USER_ID", "PROPERTY_FREE", "PROPERTY_FREE_WITH_VK_SUBSCRIBE");
    $arFilter = Array("IBLOCK_ID" => 6, "ACTIVE" => "Y", "PROPERTY_USER_ID" => $USER->GetID());
    $res = CIBlockElement::GetList(Array(), $arFilter, false, false, $arSelect);

    $freeList = '';

    while ($ob = $res->GetNextElement()) {
        $arFields = $ob->GetFields();
        $freeList["id"] = $arFields["ID"];
        $freeList["free"] = $arFields["PROPERTY_FREE_VALUE"];
        $freeList["freeWithSubscribedVK"] = $arFields["PROPERTY_FREE_WITH_VK_SUBSCRIBE_VALUE"];
    }

    print_r(json_encode(Array("data" => $freeList)));
}
?>

<? //----------------------------------------------------------------------------
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/epilog_after.php"); ?>