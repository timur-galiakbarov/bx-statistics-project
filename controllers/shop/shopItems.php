<?// подключение служебной части пролога
require($_SERVER["DOCUMENT_ROOT"]."/bitrix/modules/main/include/prolog_before.php");
//------------------------------------------------------------------------------?>
<?
if (CModule::IncludeModule("iblock")) {

    global $USER;
    $arSelect = Array("ID", "NAME", "PROPERTY_USER_ID", "PREVIEW_TEXT", "PROPERTY_COST", "PROPERTY_IMAGES");
    $arFilter = Array("IBLOCK_ID" => 17, "ACTIVE" => "Y", "PROPERTY_USER_ID_VALUE" => $USER->GetID());
    $res = CIBlockElement::GetList(Array(), $arFilter, false, false, $arSelect);

    $pagesList = '';
    $i = 0;
    while ($ob = $res->GetNextElement()) {
        $arFields = $ob->GetFields();
        $pagesList[$i]["name"] = $arFields["NAME"];
        $pagesList[$i]["id"] = $arFields["ID"];
        $pagesList[$i]["description"] = $arFields["PREVIEW_TEXT"];
        $pagesList[$i]["cost"] = $arFields["PROPERTY_COST_VALUE"];

        for ($j=0; $j<count($arFields["PROPERTY_IMAGES_VALUE"]); $j++){
            $pagesList[$i]["images"][$j] = CFILE::GetPath($arFields["PROPERTY_IMAGES_VALUE"][$j]);
        }

        $i++;
    }

    print_r(json_encode(Array('data' => $pagesList, 'success'=>true))); //, 'arFields'=>$arFields1, 'arProps'=>$res
} else {
    print_r(json_encode(Array('success' => false)));
}
?>
<?//----------------------------------------------------------------------------
require($_SERVER["DOCUMENT_ROOT"]."/bitrix/modules/main/include/epilog_after.php");?>