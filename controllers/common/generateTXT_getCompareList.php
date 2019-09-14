<? // подключение служебной части пролога
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/prolog_before.php");
//------------------------------------------------------------------------------?>
<?php
require_once './PHPExcel/PHPExcel.php'; // Подключаем библиотеку PHPExcel
$phpexcel = new PHPExcel(); // Создаём объект PHPExcel


$order   = array(",");
$replace = "\n";
$content = str_replace($order, $replace, $_POST["data"]);

global $USER;
$filename = "socstat_compare_" . $USER->GetID() . "_" . $_POST["dateCreate"] . ".txt";
$path = "/controllers/common/reports/" . $filename;
$fp = fopen($_SERVER['DOCUMENT_ROOT'] . $path, "wb");
fwrite($fp,$content);
fclose($fp);

print_r(json_encode(Array("success" => true, "filename" => "/controllers/common/getFile.php?filename=".$filename)));
?>
<? //----------------------------------------------------------------------------
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/epilog_after.php"); ?>
